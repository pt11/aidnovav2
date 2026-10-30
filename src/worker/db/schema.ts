import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
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

// Only pending invitations exist: accepting or revoking one deletes it. The
// token is emailed once and only its hash is stored.
export const invitations = sqliteTable(
	"invitations",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role", { enum: ["staff", "manager", "admin"] })
			.notNull()
			.default("staff"),
		departmentId: integer("department_id").references(() => departments.id, {
			onDelete: "set null",
		}),
		tokenHash: text("token_hash").notNull().unique(),
		invitedBy: text("invited_by").references(() => user.id, {
			onDelete: "set null",
		}),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("invitations_org_email_unique").on(
			table.organizationId,
			table.email,
		),
	],
);

export const announcements = sqliteTable(
	"announcements",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		title: text("title").notNull(),
		content: text("content").notNull(),
		priority: text("priority", { enum: ["normal", "high", "urgent"] })
			.notNull()
			.default("normal"),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
	},
	(table) => [index("announcements_org_idx").on(table.organizationId)],
);

export const policies = sqliteTable(
	"policies",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		title: text("title").notNull(),
		category: text("category").notNull(),
		content: text("content").notNull(),
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		isMandatory: integer("is_mandatory", { mode: "boolean" })
			.notNull()
			.default(false),
		effectiveDate: integer("effective_date", { mode: "timestamp_ms" }),
		reviewDate: integer("review_date", { mode: "timestamp_ms" }),
		version: integer("version").notNull().default(1),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [index("policies_org_idx").on(table.organizationId)],
);

// One row per person per version, so a reworded policy needs a new acknowledgment
// while the record of earlier ones is kept.
export const policyAcknowledgments = sqliteTable(
	"policy_acknowledgments",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		policyId: integer("policy_id")
			.notNull()
			.references(() => policies.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		policyVersion: integer("policy_version").notNull().default(1),
		acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		uniqueIndex("policy_acks_unique").on(
			table.policyId,
			table.userId,
			table.policyVersion,
		),
		index("policy_acks_user_idx").on(table.userId),
	],
);

export const policyReminderLog = sqliteTable(
	"policy_reminder_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		policyId: integer("policy_id")
			.notNull()
			.references(() => policies.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sentBy: text("sent_by").references(() => user.id, { onDelete: "set null" }),
		sentAt: integer("sent_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [index("policy_reminders_policy_idx").on(table.policyId)],
);

export const policyAccessDepartments = sqliteTable(
	"policy_access_departments",
	{
		policyId: integer("policy_id")
			.notNull()
			.references(() => policies.id, { onDelete: "cascade" }),
		departmentId: integer("department_id")
			.notNull()
			.references(() => departments.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.policyId, table.departmentId] })],
);

// Column names follow v1. Inside a folder, only the folder's PIN and department
// rules apply.
export const hubFolders = sqliteTable(
	"hub_folders",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		pinHash: text("pin_hash"),
		createdAt: createdAt(),
	},
	(table) => [index("hub_folders_org_idx").on(table.organizationId)],
);

export const folderAccessDepartments = sqliteTable(
	"folder_access_departments",
	{
		folderId: integer("folder_id")
			.notNull()
			.references(() => hubFolders.id, { onDelete: "cascade" }),
		departmentId: integer("department_id")
			.notNull()
			.references(() => departments.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.folderId, table.departmentId] })],
);

export const orgFiles = sqliteTable(
	"org_files",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		storageKey: text("storage_key"),
		// Only links have a url. Uploads are served through the download route.
		url: text("url"),
		name: text("name").notNull(),
		mimeType: text("mime_type"),
		sizeBytes: integer("size_bytes"),
		fileType: text("file_type", { enum: ["upload", "link"] })
			.notNull()
			.default("upload"),
		uploadedBy: text("uploaded_by").references(() => user.id, {
			onDelete: "set null",
		}),
		pinHash: text("pin_hash"),
		folderId: integer("folder_id").references(() => hubFolders.id),
		createdAt: createdAt(),
	},
	(table) => [
		index("org_files_org_idx").on(table.organizationId),
		index("org_files_folder_idx").on(table.folderId),
	],
);

export const fileAccessDepartments = sqliteTable(
	"file_access_departments",
	{
		fileId: integer("file_id")
			.notNull()
			.references(() => orgFiles.id, { onDelete: "cascade" }),
		departmentId: integer("department_id")
			.notNull()
			.references(() => departments.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.fileId, table.departmentId] })],
);

export const fileAccessLog = sqliteTable(
	"file_access_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		orgFileId: integer("org_file_id")
			.notNull()
			.references(() => orgFiles.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		action: text("action", { enum: ["view", "download", "pin_failed"] })
			.notNull()
			.default("view"),
		accessedAt: integer("accessed_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		index("file_access_log_org_idx").on(table.organizationId),
		index("file_access_log_user_idx").on(table.userId, table.action),
	],
);

// Counts questions for the daily limits. Their text is never stored.
export const assistantUsage = sqliteTable(
	"assistant_usage",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
	},
	(table) => [
		index("assistant_usage_org_idx").on(table.organizationId, table.createdAt),
		index("assistant_usage_user_idx").on(table.userId, table.createdAt),
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
