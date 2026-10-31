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

const updatedAt = () =>
	integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date());

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
// Prices are in US cents. A null limit means no limit.
export const subscriptionPlans = sqliteTable("subscription_plans", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	description: text("description"),
	monthlyPrice: integer("monthly_price").notNull().default(0),
	yearlyPrice: integer("yearly_price").notNull().default(0),
	maxUsers: integer("max_users"),
	storageLimitGb: integer("storage_limit_gb"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: createdAt(),
});

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
	planId: integer("plan_id").references(() => subscriptionPlans.id, {
		onDelete: "set null",
	}),
	// Each block adds 25 users and 10 GB. The custom limits are for custom quotes.
	extraUserBlocks: integer("extra_user_blocks").notNull().default(0),
	customMaxUsers: integer("custom_max_users"),
	customStorageGb: integer("custom_storage_gb"),
	// For the team's records. Billing happens outside the app.
	paidUntil: integer("paid_until", { mode: "timestamp_ms" }),
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

export const upgradeRequests = sqliteTable(
	"upgrade_requests",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		requestedBy: text("requested_by").references(() => user.id, {
			onDelete: "set null",
		}),
		planId: integer("plan_id").references(() => subscriptionPlans.id, {
			onDelete: "set null",
		}),
		billingCycle: text("billing_cycle", { enum: ["monthly", "yearly"] })
			.notNull()
			.default("monthly"),
		extraUserBlocks: integer("extra_user_blocks").notNull().default(0),
		message: text("message"),
		status: text("status", { enum: ["pending", "approved", "dismissed"] })
			.notNull()
			.default("pending"),
		resolvedBy: text("resolved_by").references(() => user.id, {
			onDelete: "set null",
		}),
		resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
		createdAt: createdAt(),
	},
	(table) => [
		// One waiting request per organization, enforced by the database.
		uniqueIndex("upgrade_requests_one_pending")
			.on(table.organizationId)
			.where(sql`${table.status} = 'pending'`),
	],
);

export const courses = sqliteTable(
	"courses",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		objectives: text("objectives"),
		duration: text("duration"),
		status: text("status", { enum: ["draft", "published"] })
			.notNull()
			.default("draft"),
		isMandatory: integer("is_mandatory", { mode: "boolean" })
			.notNull()
			.default(false),
		coverKey: text("cover_key"),
		coverType: text("cover_type"),
		coverBytes: integer("cover_bytes"),
		quizTitle: text("quiz_title"),
		passingScore: integer("passing_score").notNull().default(80),
		certificateEnabled: integer("certificate_enabled", { mode: "boolean" })
			.notNull()
			.default(true),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("courses_org_idx").on(table.organizationId)],
);

export const courseModules = sqliteTable(
	"course_modules",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
	},
	(table) => [index("course_modules_course_idx").on(table.courseId)],
);

export const courseLessons = sqliteTable(
	"course_lessons",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		moduleId: integer("module_id")
			.notNull()
			.references(() => courseModules.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		lessonType: text("lesson_type", { enum: ["reading", "document"] })
			.notNull()
			.default("reading"),
		content: text("content"),
		videoUrl: text("video_url"),
		completionMethod: text("completion_method", {
			enum: ["mark", "scroll", "open"],
		})
			.notNull()
			.default("mark"),
		estimatedTime: text("estimated_time"),
		isRequired: integer("is_required", { mode: "boolean" })
			.notNull()
			.default(true),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("course_lessons_course_idx").on(table.courseId),
		index("course_lessons_module_idx").on(table.moduleId),
	],
);

export const lessonMaterials = sqliteTable(
	"lesson_materials",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		lessonId: integer("lesson_id")
			.notNull()
			.references(() => courseLessons.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		mimeType: text("mime_type").notNull(),
		// Null until a large video finishes uploading.
		sizeBytes: integer("size_bytes"),
		// An upload has its own key. A file chosen from the Hub only has a fileId.
		storageKey: text("storage_key"),
		fileId: integer("file_id").references(() => orgFiles.id, {
			onDelete: "cascade",
		}),
		uploadId: text("upload_id"),
		isRequired: integer("is_required", { mode: "boolean" })
			.notNull()
			.default(false),
		// Reported by the first viewer, as pages can only be counted in the browser.
		pageCount: integer("page_count"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
	},
	(table) => [
		index("lesson_materials_lesson_idx").on(table.lessonId),
		index("lesson_materials_org_idx").on(table.organizationId),
	],
);

export const quizQuestions = sqliteTable(
	"quiz_questions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		question: text("question").notNull(),
		type: text("type", { enum: ["single", "multiple", "truefalse"] }).notNull(),
		// [{ text, correct }]. Never sent to learners before they pass.
		options: text("options").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
	},
	(table) => [index("quiz_questions_course_idx").on(table.courseId)],
);

export const courseEnrollments = sqliteTable(
	"course_enrollments",
	{
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// False for someone who only has a row because the course is mandatory.
		isAssigned: integer("is_assigned", { mode: "boolean" })
			.notNull()
			.default(false),
		assignedBy: text("assigned_by").references(() => user.id, {
			onDelete: "set null",
		}),
		startedAt: integer("started_at", { mode: "timestamp_ms" }),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		createdAt: createdAt(),
	},
	(table) => [
		primaryKey({ columns: [table.courseId, table.userId] }),
		index("course_enrollments_user_idx").on(table.userId),
	],
);

export const lessonProgress = sqliteTable(
	"lesson_progress",
	{
		lessonId: integer("lesson_id")
			.notNull()
			.references(() => courseLessons.id, { onDelete: "cascade" }),
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		completedAt: integer("completed_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		primaryKey({ columns: [table.lessonId, table.userId] }),
		index("lesson_progress_course_idx").on(table.courseId, table.userId),
	],
);

export const materialProgress = sqliteTable(
	"material_progress",
	{
		materialId: integer("material_id")
			.notNull()
			.references(() => lessonMaterials.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		viewedPages: text("viewed_pages").notNull().default("[]"),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
	},
	(table) => [primaryKey({ columns: [table.materialId, table.userId] })],
);

export const quizAttempts = sqliteTable(
	"quiz_attempts",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		courseId: integer("course_id")
			.notNull()
			.references(() => courses.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		score: integer("score").notNull(),
		correct: integer("correct").notNull(),
		total: integer("total").notNull(),
		passed: integer("passed", { mode: "boolean" }).notNull(),
		// The questions as they were, so later edits don't change a past result.
		review: text("review").notNull(),
		createdAt: createdAt(),
	},
	(table) => [index("quiz_attempts_course_idx").on(table.courseId, table.userId)],
);

// Copies its names, so a certificate survives the course or person changing.
export const certificates = sqliteTable(
	"certificates",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		courseId: integer("course_id").references(() => courses.id, {
			onDelete: "set null",
		}),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientName: text("recipient_name").notNull(),
		courseTitle: text("course_title").notNull(),
		organizationName: text("organization_name").notNull(),
		score: integer("score"),
		code: text("code").notNull(),
		issuedAt: integer("issued_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("certificates_course_user").on(table.courseId, table.userId),
		index("certificates_user_idx").on(table.userId),
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
