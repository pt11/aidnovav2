import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "./db";
import { addonRequests, addons, auditLog, organizationAddons } from "./db/schema";
import { jsonError, requireOrg, requireRole, requireUser, type AppEnv } from "./middleware";
import { cleanText, readJson } from "./validate";

// Every add-on there can be. Prices and whether each is on sale live in the database.
export const ADDON_KEYS = ["module:projects", "module:capacity_building", "module:people_directory", "ai:messages"] as const;
export type AddonKey = (typeof ADDON_KEYS)[number];
export const isAddonKey = (value: unknown): value is AddonKey => ADDON_KEYS.includes(value as AddonKey);
export const MAX_ADDON_QUANTITY = 100;

export async function getAddonCatalog(db: Db) {
	const rows = await db.select().from(addons);
	// The migration adds every row. This keeps a fresh database working anyway.
	return ADDON_KEYS.map(
		(key) =>
			rows.find((row) => row.key === key) ?? {
				key,
				monthlyPrice: 0,
				yearlyPrice: 0,
				unitSize: key === "ai:messages" ? 1000 : null,
				onSale: false,
				updatedBy: null,
				updatedAt: null,
			},
	);
}

// Bought and not cancelled or ended.
export function activeAddonFilter(now = new Date()) {
	return and(eq(organizationAddons.status, "active"), or(isNull(organizationAddons.endsAt), gt(organizationAddons.endsAt, now)));
}

export async function activeAddons(db: Db, organizationId: number) {
	return db
		.select()
		.from(organizationAddons)
		.where(and(eq(organizationAddons.organizationId, organizationId), activeAddonFilter()));
}

// Monthly messages added by message packs, for one organization.
export async function extraAiMessages(db: Db, organizationId: number) {
	const [catalog, owned] = await Promise.all([getAddonCatalog(db), activeAddons(db, organizationId)]);
	const size = catalog.find((row) => row.key === "ai:messages")?.unitSize ?? 0;
	return owned.filter((row) => row.addonKey === "ai:messages").reduce((sum, row) => sum + row.quantity * size, 0);
}

export const addonRoutes = new Hono<AppEnv>();
const gate = [requireUser, requireOrg] as const;

// Everyone can see what their organization has. Prices for sale show only
// once the AidNova team puts something on sale.
addonRoutes.get("/organizations/current/addons", ...gate, async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const [catalog, owned, pending] = await Promise.all([
		getAddonCatalog(db),
		activeAddons(db, org.organizationId),
		db
			.select({ addonKey: addonRequests.addonKey, quantity: addonRequests.quantity, createdAt: addonRequests.createdAt })
			.from(addonRequests)
			.where(and(eq(addonRequests.organizationId, org.organizationId), eq(addonRequests.status, "pending"))),
	]);
	return c.json({
		active: owned.map((row) => ({
			key: row.addonKey,
			quantity: row.quantity,
			price: row.price,
			billingCycle: row.billingCycle,
			endsAt: row.endsAt,
			unitSize: catalog.find((item) => item.key === row.addonKey)?.unitSize ?? null,
		})),
		forSale: catalog
			.filter((item) => item.onSale)
			.map((item) => ({ key: item.key, monthlyPrice: item.monthlyPrice, yearlyPrice: item.yearlyPrice, unitSize: item.unitSize })),
		pending,
	});
});

addonRoutes.post("/organizations/current/addon-requests", ...gate, requireRole("admin"), async (c) => {
	const db = c.get("db");
	const org = c.get("org");
	const body = await readJson(c.req.raw);
	const quantity = body.quantity ?? 1;
	const message = cleanText(body.message).slice(0, 1000);
	if (
		!isAddonKey(body.addonKey) ||
		!(body.billingCycle === "monthly" || body.billingCycle === "yearly") ||
		typeof quantity !== "number" ||
		!Number.isInteger(quantity) ||
		quantity < 1 ||
		quantity > MAX_ADDON_QUANTITY
	) {
		return jsonError(c, 400, "INVALID_REQUEST", "Check the request.");
	}
	const item = (await getAddonCatalog(db)).find((row) => row.key === body.addonKey);
	if (!item?.onSale) return jsonError(c, 409, "NOT_ON_SALE", "That add-on isn't available yet.");
	const [waiting] = await db
		.select({ id: addonRequests.id })
		.from(addonRequests)
		.where(and(eq(addonRequests.organizationId, org.organizationId), eq(addonRequests.addonKey, body.addonKey), eq(addonRequests.status, "pending")));
	if (waiting) return jsonError(c, 409, "ALREADY_REQUESTED", "You've already asked for this. We'll be in touch.");
	const [created] = await db
		.insert(addonRequests)
		.values({
			organizationId: org.organizationId,
			addonKey: body.addonKey,
			quantity: body.addonKey === "ai:messages" ? quantity : 1,
			billingCycle: body.billingCycle,
			message: message || null,
			requestedBy: c.get("user").id,
		})
		.returning({ id: addonRequests.id });
	await db.insert(auditLog).values({
		organizationId: org.organizationId,
		actorUserId: c.get("user").id,
		action: "addon.requested",
		targetType: "addon_request",
		targetId: String(created.id),
		metadata: JSON.stringify({ addonKey: body.addonKey }),
	});
	return c.json(created, 201);
});
