import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
	integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`);

// Better Auth tables. Field names are the ones Better Auth expects.
export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	isSuperAdmin: integer("is_super_admin", { mode: "boolean" })
		.notNull()
		.default(false),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: createdAt(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: createdAt(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [index("session_user_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: createdAt(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [index("account_user_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: createdAt(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = sqliteTable("rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: integer("last_request").notNull(),
});

// AidNova tables. Integer ids and column names follow v1 so existing
// organizations can be imported later.
export const organizations = sqliteTable("organizations", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logoUrl: text("logo_url"),
	email: text("email"),
	phone: text("phone"),
	website: text("website"),
	address: text("address"),
	// Unique: one user can own only one organization, enforced by the database.
	ownerId: text("owner_id")
		.notNull()
		.unique()
		.references(() => user.id),
	trialStartDate: integer("trial_start_date", { mode: "timestamp_ms" }),
	trialEndDate: integer("trial_end_date", { mode: "timestamp_ms" }),
	subscriptionStatus: text("subscription_status", {
		enum: ["trial", "active", "suspended", "cancelled"],
	})
		.notNull()
		.default("trial"),
	billingCycle: text("billing_cycle", { enum: ["monthly", "yearly"] })
		.notNull()
		.default("monthly"),
	createdAt: createdAt(),
});

export const departments = sqliteTable(
	"departments",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		description: text("description"),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
	},
	(table) => [index("departments_org_idx").on(table.organizationId)],
);

export const userProfiles = sqliteTable(
	"user_profiles",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		role: text("role", { enum: ["staff", "manager", "admin"] })
			.notNull()
			.default("staff"),
		departmentId: integer("department_id").references(() => departments.id, {
			onDelete: "set null",
		}),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		bio: text("bio"),
		position: text("position"),
		interviewDate: integer("interview_date", { mode: "timestamp_ms" }),
		onboardingDate: integer("onboarding_date", { mode: "timestamp_ms" }),
		resumeUrl: text("resume_url"),
		resumeName: text("resume_name"),
		contactEmail: text("contact_email"),
		viberLink: text("viber_link"),
		facebookLink: text("facebook_link"),
	},
	(table) => [
		index("user_profiles_org_idx").on(table.organizationId),
		uniqueIndex("user_profiles_user_org_unique").on(
			table.userId,
			table.organizationId,
		),
	],
);

export const auditLog = sqliteTable(
	"audit_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id").references(
			() => organizations.id,
			{ onDelete: "set null" },
		),
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		action: text("action").notNull(),
		targetType: text("target_type"),
		targetId: text("target_id"),
		metadata: text("metadata"),
		createdAt: createdAt(),
	},
	(table) => [index("audit_log_org_idx").on(table.organizationId)],
);
