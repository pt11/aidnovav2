import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { activeAddonFilter, getAddonCatalog, isAddonKey, MAX_ADDON_QUANTITY } from "./addons";
import { addonRequests, addons, auditLog, organizationAddons, organizations } from "./db/schema";
import { jsonError, requireSuperAdmin, requireUser, type AppEnv } from "./middleware";
import { cleanText, readJson } from "./validate";

// The AidNova team sets prices, says what's on sale, and records who bought what.
export const superadminAddonRoutes = new Hono<AppEnv>();
superadminAddonRoutes.use("/superadmin/*", requireUser, requireSuperAdmin);

const MAX_PRICE_CENTS = 10_000_000;

function audit(actorUserId: string, organizationId: number | null, action: string, targetId: string, metadata?: unknown) {
	return {
		organizationId,
		actorUserId,
		action,
		targetType: "addon",
		targetId,
		metadata: metadata === undefined ? null : JSON.stringify(metadata),
	};
}

const cents = (value: unknown) =>
	typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_PRICE_CENTS ? value : undefined;
const quantityOf = (value: unknown) =>
	typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ADDON_QUANTITY ? value : undefined;

function endDate(value: unknown): Date | null | undefined {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const date = new Date(`${value}T23:59:59.000Z`);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

superadminAddonRoutes.get("/superadmin/addons", async (c) => {
	const db = c.get("db");
	const [catalog, owned, requests] = await Promise.all([
		getAddonCatalog(db),
		db
			.select({
				id: organizationAddons.id,
				organizationId: organizationAddons.organizationId,
				organizationName: organizations.name,
				addonKey: organizationAddons.addonKey,
				quantity: organizationAddons.quantity,
				price: organizationAddons.price,
				billingCycle: organizationAddons.billingCycle,
				endsAt: organizationAddons.endsAt,
				note: organizationAddons.note,
				createdAt: organizationAddons.createdAt,
			})
			.from(organizationAddons)
			.innerJoin(organizations, eq(organizationAddons.organizationId, organizations.id))
			.where(activeAddonFilter())
			.orderBy(organizations.name),
		db
			.select({
				id: addonRequests.id,
				organizationId: addonRequests.organizationId,
				organizationName: organizations.name,
				addonKey: addonRequests.addonKey,
				quantity: addonRequests.quantity,
				billingCycle: addonRequests.billingCycle,
				message: addonRequests.message,
				createdAt: addonRequests.createdAt,
			})
			.from(addonRequests)
			.innerJoin(organizations, eq(addonRequests.organizationId, organizations.id))
			.where(eq(addonRequests.status, "pending"))
			.orderBy(desc(addonRequests.createdAt)),
	]);
	return c.json({
		catalog: catalog.map(({ key, monthlyPrice, yearlyPrice, unitSize, onSale }) => ({ key, monthlyPrice, yearlyPrice, unitSize, onSale })),
		active: owned,
		requests,
	});
});

superadminAddonRoutes.put("/superadmin/addons/:key", async (c) => {
	const db = c.get("db");
	const key = c.req.param("key");
	const body = await readJson(c.req.raw);
	const monthlyPrice = cents(body.monthlyPrice);
	const yearlyPrice = cents(body.yearlyPrice);
	const packSize = (value: unknown) =>
		typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : undefined;
	// Only a message pack has a size.
	const unitSize = key === "ai:messages" ? packSize(body.unitSize) : null;
	if (!isAddonKey(key)) return jsonError(c, 404, "NOT_FOUND", "That add-on doesn't exist.");
	if (monthlyPrice === undefined || yearlyPrice === undefined || unitSize === undefined || typeof body.onSale !== "boolean") {
		return jsonError(c, 400, "INVALID_ADDON", "Check the prices.");
	}
	if (body.onSale && monthlyPrice === 0 && yearlyPrice === 0) {
		return jsonError(c, 400, "NO_PRICE", "Set a price before putting it on sale.");
	}
	const values = { monthlyPrice, yearlyPrice, unitSize, onSale: body.onSale, updatedBy: c.get("user").id, updatedAt: new Date() };
	await db.batch([
		db.insert(addons).values({ key, ...values }).onConflictDoUpdate({ target: addons.key, set: values }),
		db.insert(auditLog).values(audit(c.get("user").id, null, "addon.price_changed", key, { monthlyPrice, yearlyPrice, unitSize, onSale: body.onSale })),
	]);
	return c.json({ ok: true });
});

// Records an add-on for an organization, with the price agreed with them.
superadminAddonRoutes.post("/superadmin/organization-addons", async (c) => {
	const db = c.get("db");
	const body = await readJson(c.req.raw);
	const organizationId = Number(body.organizationId);
	const quantity = quantityOf(body.quantity ?? 1);
	const price = cents(body.price);
	const endsAt = endDate(body.endsAt);
	const note = cleanText(body.note).slice(0, 300);
	if (
		!isAddonKey(body.addonKey) ||
		quantity === undefined ||
		price === undefined ||
		endsAt === undefined ||
		!(body.billingCycle === "monthly" || body.billingCycle === "yearly")
	) {
		return jsonError(c, 400, "INVALID_ADDON", "Check the add-on details.");
	}
	const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId));
	if (!org) return jsonError(c, 404, "NOT_FOUND", "That organization doesn't exist.");
	// A module is either added or not. Message packs can be added more than once.
	if (body.addonKey !== "ai:messages") {
		const [existing] = await db
			.select({ id: organizationAddons.id })
			.from(organizationAddons)
			.where(and(eq(organizationAddons.organizationId, organizationId), eq(organizationAddons.addonKey, body.addonKey), activeAddonFilter()));
		if (existing) return jsonError(c, 409, "ALREADY_ADDED", "This organization already has that add-on.");
	}
	const [created] = await db
		.insert(organizationAddons)
		.values({
			organizationId,
			addonKey: body.addonKey,
			quantity: body.addonKey === "ai:messages" ? quantity : 1,
			price,
			billingCycle: body.billingCycle,
			endsAt,
			note: note || null,
			createdBy: c.get("user").id,
		})
		.returning({ id: organizationAddons.id });
	await db.insert(auditLog).values(audit(c.get("user").id, organizationId, "addon.added", String(created.id), { addonKey: body.addonKey, quantity, price }));
	return c.json(created, 201);
});

superadminAddonRoutes.post("/superadmin/organization-addons/:id/cancel", async (c) => {
	const db = c.get("db");
	const id = Number(c.req.param("id"));
	const [cancelled] = await db
		.update(organizationAddons)
		.set({ status: "cancelled", cancelledAt: new Date() })
		.where(and(eq(organizationAddons.id, id), eq(organizationAddons.status, "active")))
		.returning({ id: organizationAddons.id, organizationId: organizationAddons.organizationId });
	if (!cancelled) return jsonError(c, 404, "NOT_FOUND", "That add-on isn't active.");
	await db.insert(auditLog).values(audit(c.get("user").id, cancelled.organizationId, "addon.cancelled", String(id)));
	return c.json({ ok: true });
});

// Approving records the add-on at today's catalog price.
superadminAddonRoutes.post("/superadmin/addon-requests/:id/:decision", async (c) => {
	const db = c.get("db");
	const decision = c.req.param("decision");
	if (decision !== "approve" && decision !== "dismiss") return jsonError(c, 404, "NOT_FOUND", "Not found.");
	const id = Number(c.req.param("id"));
	const [request] = await db
		.select()
		.from(addonRequests)
		.where(and(eq(addonRequests.id, id), eq(addonRequests.status, "pending")));
	if (!request) return jsonError(c, 404, "NOT_FOUND", "That request isn't waiting any more.");
	const actor = c.get("user").id;
	const resolve = db
		.update(addonRequests)
		.set({ status: decision === "approve" ? "approved" : "dismissed", resolvedBy: actor, resolvedAt: new Date() })
		.where(eq(addonRequests.id, id));
	const log = db.insert(auditLog).values(audit(actor, request.organizationId, `addon.request_${decision}d`, String(id)));
	if (decision === "dismiss") {
		await db.batch([resolve, log]);
		return c.json({ id });
	}
	if (request.addonKey !== "ai:messages") {
		const [existing] = await db
			.select({ id: organizationAddons.id })
			.from(organizationAddons)
			.where(and(eq(organizationAddons.organizationId, request.organizationId), eq(organizationAddons.addonKey, request.addonKey), activeAddonFilter()));
		if (existing) return jsonError(c, 409, "ALREADY_ADDED", "This organization already has that add-on. Dismiss the request instead.");
	}
	const item = (await getAddonCatalog(db)).find((row) => row.key === request.addonKey);
	const unitPrice = request.billingCycle === "yearly" ? (item?.yearlyPrice ?? 0) : (item?.monthlyPrice ?? 0);
	await db.batch([
		resolve,
		db.insert(organizationAddons).values({
			organizationId: request.organizationId,
			addonKey: request.addonKey,
			quantity: request.quantity,
			price: unitPrice * request.quantity,
			billingCycle: request.billingCycle,
			createdBy: actor,
		}),
		log,
	]);
	return c.json({ id });
});
