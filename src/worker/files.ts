import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { hashPassword, verifyPassword } from "./auth";
import type { Db } from "./db";
import {
	auditLog,
	departments,
	fileAccessDepartments,
	fileAccessLog,
	folderAccessDepartments,
	hubFolders,
	orgFiles,
	user,
} from "./db/schema";
import {
	jsonError,
	requireOrg,
	requireRole,
	requireUser,
	type AppEnv,
	type Membership,
} from "./middleware";
import { getOrgLimits, getStorageUsed } from "./plans";
import { getOwnDepartmentId } from "./policies";
import { cleanText, isSafeLink, readJson } from "./validate";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UNLOCK_MS = 10 * 60 * 1000;
const PIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_PIN_FAILURES = 10;
const PIN_PATTERN = /^\d{4,8}$/;

// The type comes from this list, never from the browser. Formats that can run
// scripts when opened, such as HTML and SVG, are deliberately left out.
const FILE_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	txt: "text/plain",
	csv: "text/csv",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	mp4: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	zip: "application/zip",
};
const PREVIEW_TYPES = new Set([
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
]);

const requireManager = requireRole("manager", "admin");

function isManager(org: Membership) {
	return org.role === "manager" || org.role === "admin";
}

function extensionOf(name: string) {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function canAccessDepartments(
	org: Membership,
	accessIds: number[],
	departmentId: number | null,
) {
	return (
		isManager(org) ||
		accessIds.length === 0 ||
		(departmentId !== null && accessIds.includes(departmentId))
	);
}

async function folderAccess(db: Db, organizationId: number) {
	const rows = await db
		.select({
			folderId: folderAccessDepartments.folderId,
			id: departments.id,
			name: departments.name,
		})
		.from(folderAccessDepartments)
		.innerJoin(departments, eq(folderAccessDepartments.departmentId, departments.id))
		.where(eq(departments.organizationId, organizationId));
	const access = new Map<number, { id: number; name: string }[]>();
	for (const { folderId, ...department } of rows) {
		access.set(folderId, [...(access.get(folderId) ?? []), department]);
	}
	return access;
}

async function fileAccess(db: Db, organizationId: number) {
	const rows = await db
		.select({
			fileId: fileAccessDepartments.fileId,
			id: departments.id,
			name: departments.name,
		})
		.from(fileAccessDepartments)
		.innerJoin(departments, eq(fileAccessDepartments.departmentId, departments.id))
		.where(eq(departments.organizationId, organizationId));
	const access = new Map<number, { id: number; name: string }[]>();
	for (const { fileId, ...department } of rows) {
		access.set(fileId, [...(access.get(fileId) ?? []), department]);
	}
	return access;
}

async function departmentsBelongToOrg(
	db: Db,
	organizationId: number,
	ids: number[],
) {
	if (ids.length === 0) return true;
	const rows = await db
		.select({ id: departments.id })
		.from(departments)
		.where(
			and(
				eq(departments.organizationId, organizationId),
				inArray(departments.id, ids),
			),
		);
	return rows.length === ids.length;
}

function readDepartmentIds(value: unknown): number[] | null {
	if (value === undefined) return [];
	if (!Array.isArray(value) || !value.every((id) => typeof id === "number")) {
		return null;
	}
	return [...new Set(value as number[])];
}

function findFolder(db: Db, id: number, organizationId: number) {
	return db
		.select()
		.from(hubFolders)
		.where(and(eq(hubFolders.id, id), eq(hubFolders.organizationId, organizationId)))
		.then((rows) => rows[0]);
}

// Everything needed to decide whether someone can open a file. Inside a folder
// only the folder's rules apply, so there's one place to look.
async function loadFileForUser(
	db: Db,
	id: number,
	org: Membership,
	userId: string,
) {
	const [file] = await db
		.select()
		.from(orgFiles)
		.where(
			and(eq(orgFiles.id, id), eq(orgFiles.organizationId, org.organizationId)),
		);
	if (!file) return null;
	const folder = file.folderId
		? await findFolder(db, file.folderId, org.organizationId)
		: undefined;
	const [departmentId, accessRows] = await Promise.all([
		getOwnDepartmentId(db, org, userId),
		folder
			? db
					.select({ id: folderAccessDepartments.departmentId })
					.from(folderAccessDepartments)
					.where(eq(folderAccessDepartments.folderId, folder.id))
			: db
					.select({ id: fileAccessDepartments.departmentId })
					.from(fileAccessDepartments)
					.where(eq(fileAccessDepartments.fileId, file.id)),
	]);
	const accessIds = accessRows.map((row) => row.id);
	if (!canAccessDepartments(org, accessIds, departmentId)) return null;
	const pinHash = folder ? folder.pinHash : file.pinHash;
	const pinScope = folder ? `folder:${folder.id}` : `file:${file.id}`;
	return { file, pinHash, pinScope };
}

async function signingKey(secret: string) {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(`file-unlock:${secret}`),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

function toBase64Url(bytes: ArrayBuffer) {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

// Tied to this person and this PIN, so it can't be shared and stops working as
// soon as the PIN changes.
async function createUnlockToken(
	secret: string,
	userId: string,
	scope: string,
	pinHash: string,
) {
	const expires = Date.now() + UNLOCK_MS;
	const signature = await crypto.subtle.sign(
		"HMAC",
		await signingKey(secret),
		new TextEncoder().encode(`${userId}|${scope}|${pinHash}|${expires}`),
	);
	return `${expires}.${toBase64Url(signature)}`;
}

async function isUnlockTokenValid(
	secret: string,
	token: string | undefined,
	userId: string,
	scope: string,
	pinHash: string,
) {
	const [expires, signature] = (token ?? "").split(".");
	if (!expires || !signature || Number(expires) < Date.now()) return false;
	const expected = await crypto.subtle.sign(
		"HMAC",
		await signingKey(secret),
		new TextEncoder().encode(`${userId}|${scope}|${pinHash}|${expires}`),
	);
	const actual = toBase64Url(expected);
	if (actual.length !== signature.length) return false;
	let difference = 0;
	for (let index = 0; index < actual.length; index++) {
		difference |= actual.charCodeAt(index) ^ signature.charCodeAt(index);
	}
	return difference === 0;
}

// undefined keeps the current PIN, null removes it, and a string replaces it.
async function readPin(value: unknown): Promise<string | null | undefined | false> {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== "string" || !PIN_PATTERN.test(value)) return false;
	return hashPassword(value);
}

function contentDisposition(type: "inline" | "attachment", name: string) {
	const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Every file this person can see, without anything that must stay private.
export async function listVisibleFiles(
	db: Db,
	org: Membership,
	departmentId: number | null,
) {
	const [rows, folders, foldersAccess, filesAccess] = await Promise.all([
		db
			.select({
				id: orgFiles.id,
				name: orgFiles.name,
				fileType: orgFiles.fileType,
				mimeType: orgFiles.mimeType,
				sizeBytes: orgFiles.sizeBytes,
				url: orgFiles.url,
				folderId: orgFiles.folderId,
				pinHash: orgFiles.pinHash,
				createdAt: orgFiles.createdAt,
				uploaderName: user.name,
			})
			.from(orgFiles)
			.leftJoin(user, eq(orgFiles.uploadedBy, user.id))
			.where(eq(orgFiles.organizationId, org.organizationId))
			.orderBy(desc(orgFiles.createdAt), desc(orgFiles.id)),
		db
			.select({ id: hubFolders.id, pinHash: hubFolders.pinHash })
			.from(hubFolders)
			.where(eq(hubFolders.organizationId, org.organizationId)),
		folderAccess(db, org.organizationId),
		fileAccess(db, org.organizationId),
	]);
	const folderPins = new Map(folders.map((folder) => [folder.id, folder.pinHash]));
	return rows.flatMap(({ pinHash, url, ...file }) => {
		const allowed = file.folderId
			? (foldersAccess.get(file.folderId) ?? [])
			: (filesAccess.get(file.id) ?? []);
		if (
			!canAccessDepartments(
				org,
				allowed.map((department) => department.id),
				departmentId,
			)
		) {
			return [];
		}
		const effectivePin = file.folderId
			? (folderPins.get(file.folderId) ?? null)
			: pinHash;
		return [
			{
				...file,
				departments: file.folderId ? [] : allowed,
				pinProtected: effectivePin !== null,
				pinScope: file.folderId ? `folder:${file.folderId}` : `file:${file.id}`,
				canPreview: PREVIEW_TYPES.has(file.mimeType ?? ""),
				// A protected link's address stays hidden until the PIN is entered.
				url: effectivePin === null ? url : null,
			},
		];
	});
}

export const fileRoutes = new Hono<AppEnv>();

fileRoutes.get("/folders", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const [rows, access, departmentId, counts] = await Promise.all([
		db
			.select({
				id: hubFolders.id,
				name: hubFolders.name,
				pinHash: hubFolders.pinHash,
			})
			.from(hubFolders)
			.where(eq(hubFolders.organizationId, org.organizationId))
			.orderBy(hubFolders.name),
		folderAccess(db, org.organizationId),
		getOwnDepartmentId(db, org, c.get("user").id),
		db
			.select({ folderId: orgFiles.folderId, total: count() })
			.from(orgFiles)
			.where(eq(orgFiles.organizationId, org.organizationId))
			.groupBy(orgFiles.folderId),
	]);
	const totals = new Map(counts.map((row) => [row.folderId, row.total]));
	return c.json({
		folders: rows.flatMap(({ pinHash, ...folder }) => {
			const allowed = access.get(folder.id) ?? [];
			if (
				!canAccessDepartments(
					org,
					allowed.map((department) => department.id),
					departmentId,
				)
			) {
				return [];
			}
			return [
				{
					...folder,
					pinProtected: pinHash !== null,
					departments: allowed,
					fileCount: totals.get(folder.id) ?? 0,
				},
			];
		}),
	});
});

fileRoutes.post(
	"/folders",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const departmentIds = readDepartmentIds(body.departmentIds);
		const pinHash = await readPin(body.pin);
		if (name.length < 1 || name.length > 255 || !departmentIds) {
			return jsonError(c, 400, "INVALID_FOLDER", "Enter a folder name.");
		}
		if (pinHash === false) {
			return jsonError(c, 400, "INVALID_PIN", "A PIN must be 4 to 8 digits.");
		}
		const db = c.get("db");
		const org = c.get("org");
		if (!(await departmentsBelongToOrg(db, org.organizationId, departmentIds))) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose valid departments.");
		}
		const [created] = await db
			.insert(hubFolders)
			.values({
				name,
				organizationId: org.organizationId,
				createdBy: c.get("user").id,
				pinHash: pinHash ?? null,
			})
			.returning({ id: hubFolders.id });
		if (departmentIds.length) {
			await db.insert(folderAccessDepartments).values(
				departmentIds.map((departmentId) => ({
					folderId: created.id,
					departmentId,
				})),
			);
		}
		return c.json(created, 201);
	},
);

fileRoutes.patch(
	"/folders/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const departmentIds = readDepartmentIds(body.departmentIds);
		const pinHash = await readPin(body.pin);
		if (name.length < 1 || name.length > 255 || !departmentIds) {
			return jsonError(c, 400, "INVALID_FOLDER", "Enter a folder name.");
		}
		if (pinHash === false) {
			return jsonError(c, 400, "INVALID_PIN", "A PIN must be 4 to 8 digits.");
		}
		const db = c.get("db");
		const org = c.get("org");
		const folder = await findFolder(db, Number(c.req.param("id")), org.organizationId);
		if (!folder) return jsonError(c, 404, "NOT_FOUND", "That folder doesn't exist.");
		if (!(await departmentsBelongToOrg(db, org.organizationId, departmentIds))) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose valid departments.");
		}
		const update = db
			.update(hubFolders)
			.set({ name, ...(pinHash === undefined ? {} : { pinHash }) })
			.where(eq(hubFolders.id, folder.id));
		const clear = db
			.delete(folderAccessDepartments)
			.where(eq(folderAccessDepartments.folderId, folder.id));
		const audit = db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: "folder.updated",
			targetType: "folder",
			targetId: String(folder.id),
		});
		if (departmentIds.length) {
			await db.batch([
				clear,
				db.insert(folderAccessDepartments).values(
					departmentIds.map((departmentId) => ({
						folderId: folder.id,
						departmentId,
					})),
				),
				update,
				audit,
			]);
		} else {
			await db.batch([clear, update, audit]);
		}
		return c.json({ id: folder.id });
	},
);

fileRoutes.delete(
	"/folders/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const folder = await findFolder(db, Number(c.req.param("id")), org.organizationId);
		if (!folder) return jsonError(c, 404, "NOT_FOUND", "That folder doesn't exist.");
		// Its files get their access rules from the folder, so removing it first
		// could open restricted files to everyone.
		const [{ total }] = await db
			.select({ total: count() })
			.from(orgFiles)
			.where(eq(orgFiles.folderId, folder.id));
		if (total > 0) {
			return jsonError(c, 409, "FOLDER_NOT_EMPTY", "Move or delete the files in this folder first.");
		}
		await db.batch([
			db.delete(hubFolders).where(eq(hubFolders.id, folder.id)),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "folder.deleted",
				targetType: "folder",
				targetId: String(folder.id),
				metadata: JSON.stringify({ name: folder.name }),
			}),
		]);
		return c.json({ id: folder.id });
	},
);

fileRoutes.get("/files", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const departmentId = await getOwnDepartmentId(db, org, c.get("user").id);
	return c.json({ files: await listVisibleFiles(db, org, departmentId) });
});

fileRoutes.get(
	"/files/usage",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const organizationId = c.get("org").organizationId;
		const [usedBytes, limits] = await Promise.all([
			getStorageUsed(db, organizationId),
			getOrgLimits(db, organizationId),
		]);
		return c.json({ usedBytes, limitBytes: limits.storageLimitBytes });
	},
);

// The body is the file itself, streamed straight to storage, so large uploads
// don't sit in the Worker's memory.
fileRoutes.post(
	"/files/upload",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const name = cleanText(c.req.query("name"));
		const mimeType = FILE_TYPES[extensionOf(name)];
		const declaredSize = Number(c.req.header("content-length"));
		const folderParam = c.req.query("folderId");
		const folderId = folderParam ? Number(folderParam) : null;

		if (name.length < 1 || name.length > 500) {
			return jsonError(c, 400, "INVALID_NAME", "That file needs a name.");
		}
		if (!mimeType) {
			return jsonError(c, 400, "TYPE_NOT_ALLOWED", "That type of file isn't allowed.");
		}
		if (!Number.isFinite(declaredSize) || declaredSize <= 0 || !c.req.raw.body) {
			return jsonError(c, 400, "EMPTY_FILE", "That file is empty.");
		}
		if (declaredSize > MAX_FILE_BYTES) {
			return jsonError(c, 413, "FILE_TOO_LARGE", "Files can be up to 50 MB.");
		}
		if (
			folderId !== null &&
			!(await findFolder(db, folderId, org.organizationId))
		) {
			return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
		}
		const [used, limits] = await Promise.all([
			getStorageUsed(db, org.organizationId),
			getOrgLimits(db, org.organizationId),
		]);
		if (
			limits.storageLimitBytes !== null &&
			used + declaredSize > limits.storageLimitBytes
		) {
			return jsonError(c, 413, "STORAGE_FULL", "Your organization's storage is full.");
		}

		// The key has nothing from the person uploading, so names can't affect it.
		const storageKey = `org/${org.organizationId}/${crypto.randomUUID()}`;
		const stored = await c.env.FILES.put(storageKey, c.req.raw.body, {
			httpMetadata: { contentType: mimeType },
		});
		try {
			const [created] = await db
				.insert(orgFiles)
				.values({
					organizationId: org.organizationId,
					storageKey,
					name,
					mimeType,
					sizeBytes: stored.size,
					fileType: "upload",
					uploadedBy: c.get("user").id,
					folderId,
				})
				.returning({ id: orgFiles.id });
			await db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "file.uploaded",
				targetType: "file",
				targetId: String(created.id),
				metadata: JSON.stringify({ name, sizeBytes: stored.size }),
			});
			return c.json(created, 201);
		} catch (error) {
			await c.env.FILES.delete(storageKey);
			throw error;
		}
	},
);

fileRoutes.post(
	"/files/link",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const url = cleanText(body.url);
		const folderId = (body.folderId ?? null) as number | null;
		const db = c.get("db");
		const org = c.get("org");
		if (name.length < 1 || name.length > 500) {
			return jsonError(c, 400, "INVALID_NAME", "Enter a name for this link.");
		}
		if (!isSafeLink(url, ["https:", "http:"])) {
			return jsonError(c, 400, "INVALID_LINK", "Enter a full link, starting with https://.");
		}
		if (
			folderId !== null &&
			(typeof folderId !== "number" ||
				!(await findFolder(db, folderId, org.organizationId)))
		) {
			return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
		}
		const [created] = await db
			.insert(orgFiles)
			.values({
				organizationId: org.organizationId,
				name,
				url,
				fileType: "link",
				uploadedBy: c.get("user").id,
				folderId,
			})
			.returning({ id: orgFiles.id });
		return c.json(created, 201);
	},
);

fileRoutes.patch(
	"/files/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const body = await readJson(c.req.raw);
		const name = cleanText(body.name);
		const departmentIds = readDepartmentIds(body.departmentIds);
		const pinHash = await readPin(body.pin);
		const folderId = (body.folderId ?? null) as number | null;
		if (name.length < 1 || name.length > 500 || !departmentIds) {
			return jsonError(c, 400, "INVALID_FILE", "Check the file details.");
		}
		if (pinHash === false) {
			return jsonError(c, 400, "INVALID_PIN", "A PIN must be 4 to 8 digits.");
		}
		const db = c.get("db");
		const org = c.get("org");
		const [file] = await db
			.select()
			.from(orgFiles)
			.where(
				and(
					eq(orgFiles.id, Number(c.req.param("id"))),
					eq(orgFiles.organizationId, org.organizationId),
				),
			);
		if (!file) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
		if (
			folderId !== null &&
			(typeof folderId !== "number" ||
				!(await findFolder(db, folderId, org.organizationId)))
		) {
			return jsonError(c, 400, "INVALID_FOLDER", "Choose a valid folder.");
		}
		if (!(await departmentsBelongToOrg(db, org.organizationId, departmentIds))) {
			return jsonError(c, 400, "INVALID_DEPARTMENT", "Choose valid departments.");
		}

		let ownPin = pinHash === undefined ? file.pinHash : pinHash;
		let ownAccess = departmentIds;
		// A file moved out of a folder keeps that folder's protection, so moving it
		// can't quietly open it to everyone.
		if (file.folderId !== null && folderId === null) {
			const previous = await findFolder(db, file.folderId, org.organizationId);
			const rows = await db
				.select({ id: folderAccessDepartments.departmentId })
				.from(folderAccessDepartments)
				.where(eq(folderAccessDepartments.folderId, file.folderId));
			ownAccess = [...new Set([...ownAccess, ...rows.map((row) => row.id)])];
			if (pinHash === undefined) ownPin = previous?.pinHash ?? null;
		}
		// Inside a folder only the folder's rules apply.
		if (folderId !== null) {
			ownPin = null;
			ownAccess = [];
		}

		const update = db
			.update(orgFiles)
			.set({ name, folderId, pinHash: ownPin })
			.where(eq(orgFiles.id, file.id));
		const clear = db
			.delete(fileAccessDepartments)
			.where(eq(fileAccessDepartments.fileId, file.id));
		const audit = db.insert(auditLog).values({
			organizationId: org.organizationId,
			actorUserId: c.get("user").id,
			action: "file.updated",
			targetType: "file",
			targetId: String(file.id),
		});
		if (ownAccess.length) {
			await db.batch([
				clear,
				db.insert(fileAccessDepartments).values(
					ownAccess.map((departmentId) => ({
						fileId: file.id,
						departmentId,
					})),
				),
				update,
				audit,
			]);
		} else {
			await db.batch([clear, update, audit]);
		}
		return c.json({ id: file.id });
	},
);

fileRoutes.delete(
	"/files/:id",
	requireUser,
	requireOrg,
	requireManager,
	async (c) => {
		const db = c.get("db");
		const org = c.get("org");
		const [file] = await db
			.select()
			.from(orgFiles)
			.where(
				and(
					eq(orgFiles.id, Number(c.req.param("id"))),
					eq(orgFiles.organizationId, org.organizationId),
				),
			);
		if (!file) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
		await db.batch([
			db.delete(orgFiles).where(eq(orgFiles.id, file.id)),
			db.insert(auditLog).values({
				organizationId: org.organizationId,
				actorUserId: c.get("user").id,
				action: "file.deleted",
				targetType: "file",
				targetId: String(file.id),
				metadata: JSON.stringify({ name: file.name }),
			}),
		]);
		if (file.storageKey) await c.env.FILES.delete(file.storageKey);
		return c.json({ id: file.id });
	},
);

fileRoutes.post("/files/:id/unlock", requireUser, requireOrg, async (c) => {
	const { pin } = await readJson(c.req.raw);
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const loaded = await loadFileForUser(db, Number(c.req.param("id")), org, userId);
	if (!loaded) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	if (!loaded.pinHash) {
		return jsonError(c, 400, "NOT_PROTECTED", "That file doesn't have a PIN.");
	}
	const since = new Date(Date.now() - PIN_WINDOW_MS);
	const [{ failures }] = await db
		.select({ failures: count() })
		.from(fileAccessLog)
		.where(
			and(
				eq(fileAccessLog.userId, userId),
				eq(fileAccessLog.organizationId, org.organizationId),
				eq(fileAccessLog.action, "pin_failed"),
				gt(fileAccessLog.accessedAt, since),
			),
		);
	if (failures >= MAX_PIN_FAILURES) {
		return jsonError(c, 429, "TOO_MANY_ATTEMPTS", "Too many PIN attempts. Try again in 15 minutes.");
	}
	const correct =
		typeof pin === "string" &&
		PIN_PATTERN.test(pin) &&
		(await verifyPassword({ hash: loaded.pinHash, password: pin }));
	if (!correct) {
		await db.insert(fileAccessLog).values({
			orgFileId: loaded.file.id,
			userId,
			organizationId: org.organizationId,
			action: "pin_failed",
		});
		return jsonError(c, 403, "WRONG_PIN", "That PIN isn't correct.");
	}
	return c.json({
		token: await createUnlockToken(
			c.env.BETTER_AUTH_SECRET,
			userId,
			loaded.pinScope,
			loaded.pinHash,
		),
		pinScope: loaded.pinScope,
	});
});

fileRoutes.get("/files/:id/open-link", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const loaded = await loadFileForUser(db, Number(c.req.param("id")), org, userId);
	if (!loaded || loaded.file.fileType !== "link" || !loaded.file.url) {
		return jsonError(c, 404, "NOT_FOUND", "That link doesn't exist.");
	}
	if (
		loaded.pinHash &&
		!(await isUnlockTokenValid(
			c.env.BETTER_AUTH_SECRET,
			c.req.query("unlock"),
			userId,
			loaded.pinScope,
			loaded.pinHash,
		))
	) {
		return jsonError(c, 403, "PIN_REQUIRED", "Enter the PIN to open this.");
	}
	await db.insert(fileAccessLog).values({
		orgFileId: loaded.file.id,
		userId,
		organizationId: org.organizationId,
		action: "view",
	});
	return c.json({ url: loaded.file.url });
});

fileRoutes.get("/files/:id/download", requireUser, requireOrg, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const userId = c.get("user").id;
	const loaded = await loadFileForUser(db, Number(c.req.param("id")), org, userId);
	if (!loaded || !loaded.file.storageKey) {
		return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");
	}
	if (
		loaded.pinHash &&
		!(await isUnlockTokenValid(
			c.env.BETTER_AUTH_SECRET,
			c.req.query("unlock"),
			userId,
			loaded.pinScope,
			loaded.pinHash,
		))
	) {
		return jsonError(c, 403, "PIN_REQUIRED", "Enter the PIN to open this.");
	}
	const object = await c.env.FILES.get(loaded.file.storageKey);
	if (!object) return jsonError(c, 404, "NOT_FOUND", "That file doesn't exist.");

	const mimeType = loaded.file.mimeType ?? "application/octet-stream";
	const inline = c.req.query("inline") === "1" && PREVIEW_TYPES.has(mimeType);
	await db.insert(fileAccessLog).values({
		orgFileId: loaded.file.id,
		userId,
		organizationId: org.organizationId,
		action: inline ? "view" : "download",
	});
	return new Response(object.body, {
		headers: {
			"Content-Type": mimeType,
			"Content-Length": String(object.size),
			"Content-Disposition": contentDisposition(
				inline ? "inline" : "attachment",
				loaded.file.name,
			),
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
			// Browsers won't show PDFs in a sandbox, and they can't run page scripts.
			"Content-Security-Policy":
				mimeType === "application/pdf"
					? "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"
					: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
		},
	});
});
