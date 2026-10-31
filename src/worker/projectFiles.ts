import { and, desc, eq, inArray, isNull, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Db } from "./db";
import {
	fileAccessDepartments,
	folderAccessDepartments,
	hubFolders,
	orgFiles,
	projectFileVersions,
	projectFiles,
	projectFolders,
	projectReportFiles,
	projectReports,
	user,
} from "./db/schema";
import { jsonError, requireOrg, requireUser, type AppEnv } from "./middleware";
import { requireModule } from "./modules";
import { getOrgLimits, getStorageUsed } from "./plans";
import { canEdit, contributes, loadVisible, record } from "./projects";
import { cleanText, readJson } from "./validate";

const FILE_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	csv: "text/csv",
	txt: "text/plain",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	zip: "application/zip",
};
const PREVIEW = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 50 * 1024 * 1024;
const STANDARD_FOLDERS = [
	"01 Project Planning",
	"02 Financial Reports",
	"03 Progress Reports",
	"04 Beneficiary Data",
	"05 Monitoring & Evaluation",
	"06 Annual Reports",
];

export const projectFileRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg, requireModule("projects")] as const;
const NOT_FOUND = "That project doesn't exist.";
const NO_FILE = "That file doesn't exist.";

function mimeOf(name: string) {
	return FILE_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
}

// A linked file keeps following the Files library's own rules. It's only listed
// by name while it's open to everyone, so a PIN or limit added later hides it.
async function openOrgFiles(db: Db, organizationId: number, ids: number[]) {
	if (ids.length === 0) return new Map<number, { name: string; mimeType: string | null; sizeBytes: number | null }>();
	const rows = await db
		.select({
			id: orgFiles.id,
			name: orgFiles.name,
			mimeType: orgFiles.mimeType,
			sizeBytes: orgFiles.sizeBytes,
			fileType: orgFiles.fileType,
			pinHash: orgFiles.pinHash,
			folderId: orgFiles.folderId,
			folderPin: hubFolders.pinHash,
		})
		.from(orgFiles)
		.leftJoin(hubFolders, eq(orgFiles.folderId, hubFolders.id))
		.where(and(eq(orgFiles.organizationId, organizationId), inArray(orgFiles.id, ids.slice(0, 100))));
	const [limitedFiles, limitedFolders] = await Promise.all([
		db.select({ id: fileAccessDepartments.fileId }).from(fileAccessDepartments).where(inArray(fileAccessDepartments.fileId, ids.slice(0, 100))),
		db.select({ id: folderAccessDepartments.folderId }).from(folderAccessDepartments),
	]);
	const closedFiles = new Set(limitedFiles.map((row) => row.id));
	const closedFolders = new Set(limitedFolders.map((row) => row.id));
	const open = rows.filter(
		(row) =>
			row.fileType === "upload" &&
			(row.folderId ? !row.folderPin && !closedFolders.has(row.folderId) : !row.pinHash && !closedFiles.has(row.id)),
	);
	return new Map(open.map((row) => [row.id, row]));
}

async function storageRoom(c: Context<AppEnv>, bytes: number) {
	const db = c.get("db");
	const organizationId = c.get("org").organizationId;
	const [used, limits] = await Promise.all([getStorageUsed(db, organizationId), getOrgLimits(db, organizationId)]);
	return limits.storageLimitBytes === null || used + bytes <= limits.storageLimitBytes;
}

async function findFile(db: Db, projectId: number, rawId: string | undefined) {
	const [file] = await db
		.select()
		.from(projectFiles)
		.where(and(eq(projectFiles.id, Number(rawId)), eq(projectFiles.projectId, projectId)));
	return file ?? null;
}

async function validFolder(db: Db, projectId: number, folderId: unknown) {
	if (folderId === null || folderId === undefined || folderId === "") return { id: null };
	const [folder] = await db
		.select({ id: projectFolders.id })
		.from(projectFolders)
		.where(and(eq(projectFolders.id, Number(folderId)), eq(projectFolders.projectId, projectId)));
	return folder ?? null;
}

function uploadProblem(c: Context<AppEnv>, name: string, mimeType: string | undefined, size: number) {
	if (name.length < 1 || name.length > 300) return jsonError(c, 400, "INVALID_NAME", "That file needs a name.");
	if (!mimeType) return jsonError(c, 400, "TYPE_NOT_ALLOWED", "That type of file isn't allowed.");
	if (!Number.isFinite(size) || size <= 0 || !c.req.raw.body) return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
	if (size > MAX_BYTES) return jsonError(c, 413, "FILE_TOO_LARGE", "Files can be up to 50 MB.");
	return null;
}

projectFileRoutes.get("/projects/:id/files", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	const [folders, files, versions, [used]] = await Promise.all([
		db.select().from(projectFolders).where(eq(projectFolders.projectId, project.id)).orderBy(projectFolders.name),
		db.select().from(projectFiles).where(eq(projectFiles.projectId, project.id)).orderBy(desc(projectFiles.updatedAt)),
		db
			.select({
				fileId: projectFileVersions.fileId,
				version: projectFileVersions.version,
				name: projectFileVersions.name,
				mimeType: projectFileVersions.mimeType,
				sizeBytes: projectFileVersions.sizeBytes,
				note: projectFileVersions.note,
				createdAt: projectFileVersions.createdAt,
				uploaderName: user.name,
			})
			.from(projectFileVersions)
			.leftJoin(user, eq(projectFileVersions.uploadedBy, user.id))
			.where(eq(projectFileVersions.projectId, project.id)),
		db
			.select({ bytes: sum(projectFileVersions.sizeBytes) })
			.from(projectFileVersions)
			.where(and(eq(projectFileVersions.projectId, project.id), isNull(projectFileVersions.restoredFrom))),
	]);
	const linked = await openOrgFiles(
		db,
		project.organizationId,
		files.flatMap((file) => (file.orgFileId ? [file.orgFileId] : [])),
	);
	return c.json({
		folders: folders.map(({ id, name, parentId }) => ({ id, name, parentId })),
		files: files.map((file) => {
			const current = versions.find((version) => version.fileId === file.id && version.version === file.currentVersion);
			const org = file.orgFileId ? linked.get(file.orgFileId) : undefined;
			return {
				id: file.id,
				folderId: file.folderId,
				currentVersion: file.currentVersion,
				updatedAt: file.updatedAt,
				orgFileId: file.orgFileId,
				unavailable: file.orgFileId !== null && !org,
				name: file.orgFileId ? (org?.name ?? null) : (current?.name ?? null),
				mimeType: file.orgFileId ? (org?.mimeType ?? null) : (current?.mimeType ?? null),
				sizeBytes: file.orgFileId ? (org?.sizeBytes ?? null) : (current?.sizeBytes ?? null),
				note: current?.note ?? null,
				updatedBy: current?.uploaderName ?? null,
				versions: file.orgFileId
					? []
					: versions
							.filter((version) => version.fileId === file.id)
							.sort((a, b) => b.version - a.version)
							.map(({ version, name, mimeType, sizeBytes, note, createdAt, uploaderName }) => ({ version, name, mimeType, sizeBytes, note, createdAt, uploaderName })),
			};
		}),
		usedBytes: Number(used?.bytes ?? 0),
		canContribute: await contributes(db, project, userId, c.get("org").role),
		canManage: canEdit(project, userId, c.get("org").role),
	});
});

projectFileRoutes.post("/projects/:id/folders", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!(await contributes(db, project, c.get("user").id, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't change this project's files.");
	}
	const body = await readJson(c.req.raw);
	const names = body.standard === true ? STANDARD_FOLDERS : [cleanText(body.name)];
	if (names.some((name) => name.length < 1 || name.length > 120)) return jsonError(c, 400, "INVALID_NAME", "Give the folder a name.");
	const parent = await validFolder(db, project.id, body.parentId);
	if (!parent) return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
	await db.insert(projectFolders).values(
		names.map((name) => ({ projectId: project.id, organizationId: project.organizationId, name, parentId: parent.id })),
	);
	return c.json({ ok: true }, 201);
});

projectFileRoutes.delete("/projects/:id/folders/:folderId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const folderId = Number(c.req.param("folderId"));
	const [[files], [children]] = await Promise.all([
		db.select({ total: sql<number>`count(*)` }).from(projectFiles).where(and(eq(projectFiles.projectId, project.id), eq(projectFiles.folderId, folderId))),
		db.select({ total: sql<number>`count(*)` }).from(projectFolders).where(and(eq(projectFolders.projectId, project.id), eq(projectFolders.parentId, folderId))),
	]);
	if (files.total > 0 || children.total > 0) return jsonError(c, 409, "FOLDER_NOT_EMPTY", "Move what's in it first.");
	await db.delete(projectFolders).where(and(eq(projectFolders.id, folderId), eq(projectFolders.projectId, project.id)));
	return c.json({ ok: true });
});

projectFileRoutes.post("/projects/:id/files", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	if (!(await contributes(db, project, userId, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't change this project's files.");
	}
	const name = cleanText(c.req.query("name"));
	const mimeType = mimeOf(name);
	const size = Number(c.req.header("content-length"));
	const problem = uploadProblem(c, name, mimeType, size);
	if (problem) return problem;
	const folder = await validFolder(db, project.id, c.req.query("folderId"));
	if (!folder) return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
	if (!(await storageRoom(c, size))) return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
	const storageKey = `org/${project.organizationId}/projects/${crypto.randomUUID()}`;
	const stored = await c.env.FILES.put(storageKey, c.req.raw.body, { httpMetadata: { contentType: mimeType } });
	try {
		const [file] = await db
			.insert(projectFiles)
			.values({ projectId: project.id, organizationId: project.organizationId, folderId: folder.id, createdBy: userId })
			.returning({ id: projectFiles.id });
		await db.insert(projectFileVersions).values({
			fileId: file.id,
			projectId: project.id,
			organizationId: project.organizationId,
			version: 1,
			name,
			mimeType,
			sizeBytes: stored.size,
			storageKey,
			note: cleanText(c.req.query("note")).slice(0, 300) || null,
			uploadedBy: userId,
		});
		await record(db, c, project.id, "file_uploaded", name);
		return c.json(file, 201);
	} catch (error) {
		await c.env.FILES.delete(storageKey);
		throw error;
	}
});

projectFileRoutes.post("/projects/:id/files/link", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	if (!(await contributes(db, project, userId, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't change this project's files.");
	}
	const body = await readJson(c.req.raw);
	const orgFileId = Number(body.orgFileId);
	const open = await openOrgFiles(db, project.organizationId, Number.isInteger(orgFileId) ? [orgFileId] : []);
	const org = open.get(orgFileId);
	if (!org) return jsonError(c, 400, "CANT_LINK", "Only files open to everyone can be linked.");
	const folder = await validFolder(db, project.id, body.folderId);
	if (!folder) return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
	const [existing] = await db
		.select({ id: projectFiles.id })
		.from(projectFiles)
		.where(and(eq(projectFiles.projectId, project.id), eq(projectFiles.orgFileId, orgFileId)));
	if (existing) return jsonError(c, 409, "ALREADY_LINKED", "That file is already linked here.");
	const [file] = await db
		.insert(projectFiles)
		.values({ projectId: project.id, organizationId: project.organizationId, folderId: folder.id, orgFileId, currentVersion: 0, createdBy: userId })
		.returning({ id: projectFiles.id });
	await record(db, c, project.id, "file_linked", org.name);
	return c.json(file, 201);
});

projectFileRoutes.post("/projects/:id/files/:fileId/versions", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	if (!(await contributes(db, project, userId, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't change this project's files.");
	}
	const file = await findFile(db, project.id, c.req.param("fileId"));
	if (!file) return jsonError(c, 404, "NOT_FOUND", NO_FILE);
	if (file.orgFileId) return jsonError(c, 400, "LINKED_FILE", "Update a linked file in Files.");
	const note = cleanText(c.req.query("note")).slice(0, 300);
	if (!note) return jsonError(c, 400, "NOTE_REQUIRED", "Say what changed.");
	const name = cleanText(c.req.query("name"));
	const mimeType = mimeOf(name);
	const size = Number(c.req.header("content-length"));
	const problem = uploadProblem(c, name, mimeType, size);
	if (problem) return problem;
	if (!(await storageRoom(c, size))) return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
	const storageKey = `org/${project.organizationId}/projects/${crypto.randomUUID()}`;
	const stored = await c.env.FILES.put(storageKey, c.req.raw.body, { httpMetadata: { contentType: mimeType } });
	const version = file.currentVersion + 1;
	try {
		await db.insert(projectFileVersions).values({
			fileId: file.id,
			projectId: project.id,
			organizationId: project.organizationId,
			version,
			name,
			mimeType,
			sizeBytes: stored.size,
			storageKey,
			note,
			uploadedBy: userId,
		});
		await db.update(projectFiles).set({ currentVersion: version }).where(eq(projectFiles.id, file.id));
	} catch (error) {
		await c.env.FILES.delete(storageKey);
		throw error;
	}
	await record(db, c, project.id, "file_version", `${name} v${version}`);
	return c.json({ version }, 201);
});

// Nothing is overwritten: restoring makes a new version that shares the old file.
projectFileRoutes.post("/projects/:id/files/:fileId/restore", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const userId = c.get("user").id;
	if (!(await contributes(db, project, userId, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't change this project's files.");
	}
	const file = await findFile(db, project.id, c.req.param("fileId"));
	if (!file) return jsonError(c, 404, "NOT_FOUND", NO_FILE);
	const wanted = Number((await readJson(c.req.raw)).version);
	const [source] = await db
		.select()
		.from(projectFileVersions)
		.where(and(eq(projectFileVersions.fileId, file.id), eq(projectFileVersions.version, wanted)));
	if (!source) return jsonError(c, 404, "NOT_FOUND", "That version doesn't exist.");
	const version = file.currentVersion + 1;
	await db.insert(projectFileVersions).values({
		fileId: file.id,
		projectId: project.id,
		organizationId: project.organizationId,
		version,
		name: source.name,
		mimeType: source.mimeType,
		sizeBytes: source.sizeBytes,
		storageKey: source.storageKey,
		note: `Restored from v${wanted}`,
		restoredFrom: wanted,
		uploadedBy: userId,
	});
	await db.update(projectFiles).set({ currentVersion: version }).where(eq(projectFiles.id, file.id));
	await record(db, c, project.id, "file_restored", `${source.name} v${wanted}`);
	return c.json({ version }, 201);
});

projectFileRoutes.patch("/projects/:id/files/:fileId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!(await contributes(db, project, c.get("user").id, c.get("org").role))) {
		return jsonError(c, 403, "FORBIDDEN", "You can't change this project's files.");
	}
	const file = await findFile(db, project.id, c.req.param("fileId"));
	if (!file) return jsonError(c, 404, "NOT_FOUND", NO_FILE);
	const folder = await validFolder(db, project.id, (await readJson(c.req.raw)).folderId);
	if (!folder) return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
	await db.update(projectFiles).set({ folderId: folder.id }).where(eq(projectFiles.id, file.id));
	return c.json({ ok: true });
});

projectFileRoutes.delete("/projects/:id/files/:fileId", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	if (!canEdit(project, c.get("user").id, c.get("org").role)) return jsonError(c, 403, "FORBIDDEN", "You can't change this project.");
	const file = await findFile(db, project.id, c.req.param("fileId"));
	if (!file) return jsonError(c, 404, "NOT_FOUND", NO_FILE);
	// A report that has gone to review has to keep what it pointed at.
	const [attached, direct] = await Promise.all([
		db
			.select({ status: projectReports.status })
			.from(projectReportFiles)
			.innerJoin(projectReports, eq(projectReportFiles.reportId, projectReports.id))
			.where(eq(projectReportFiles.fileId, file.id)),
		db.select({ status: projectReports.status }).from(projectReports).where(eq(projectReports.fileId, file.id)),
	]);
	const inUse = [...attached, ...direct].some((row) => row.status !== "draft");
	if (inUse) return jsonError(c, 409, "IN_REPORT", "A submitted report uses this file.");
	const versions = await db
		.select({ storageKey: projectFileVersions.storageKey, name: projectFileVersions.name })
		.from(projectFileVersions)
		.where(eq(projectFileVersions.fileId, file.id));
	await db.delete(projectFiles).where(eq(projectFiles.id, file.id));
	const keys = [...new Set(versions.map((version) => version.storageKey))];
	if (keys.length) await c.env.FILES.delete(keys);
	await record(db, c, project.id, "file_deleted", versions[versions.length - 1]?.name ?? null);
	return c.json({ ok: true });
});

projectFileRoutes.get("/projects/:id/files/:fileId/download", ...gate, async (c) => {
	const db = c.get("db");
	const project = await loadVisible(c);
	if (!project) return jsonError(c, 404, "NOT_FOUND", NOT_FOUND);
	const file = await findFile(db, project.id, c.req.param("fileId"));
	if (!file || file.orgFileId) return jsonError(c, 404, "NOT_FOUND", NO_FILE);
	const version = Number(c.req.query("version") ?? file.currentVersion);
	const [row] = await db
		.select()
		.from(projectFileVersions)
		.where(and(eq(projectFileVersions.fileId, file.id), eq(projectFileVersions.version, version)));
	const object = row ? await c.env.FILES.get(row.storageKey) : null;
	if (!row || !object) return jsonError(c, 404, "NOT_FOUND", NO_FILE);
	const inline = c.req.query("inline") === "1" && PREVIEW.has(row.mimeType);
	const ascii = row.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return new Response(object.body, {
		headers: {
			"Content-Type": row.mimeType,
			"Content-Length": String(object.size),
			"Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy":
				row.mimeType === "application/pdf"
					? "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"
					: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
		},
	});
});
