import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
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
	twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(false),
	isSuperAdmin: integer("is_super_admin", { mode: "boolean" })
		.notNull()
		.default(false),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: createdAt(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// Better Auth's two-step sign-in. It encrypts the secret before storing it.
export const twoFactor = sqliteTable(
	"two_factor",
	{
		id: text("id").primaryKey(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		verified: integer("verified", { mode: "boolean" }).default(true),
		failedVerificationCount: integer("failed_verification_count").default(0),
		lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("two_factor_secret_idx").on(table.secret),
		index("two_factor_user_idx").on(table.userId),
	],
);

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
	logoKey: text("logo_key"),
	logoType: text("logo_type"),
	logoBytes: integer("logo_bytes"),
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
	// Who can see who opened what. Totals and policy compliance aren't affected.
	activityReportAccess: text("activity_report_access", { enum: ["managers", "admins"] })
		.notNull()
		.default("managers"),
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
		photoKey: text("photo_key"),
		photoType: text("photo_type"),
		photoBytes: integer("photo_bytes"),
		// Empty for people who joined before this was recorded.
		joinedAt: integer("joined_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
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
		// One optional document: either a stored file or a link somewhere else.
		attachmentType: text("attachment_type", { enum: ["file", "link"] }),
		attachmentName: text("attachment_name"),
		attachmentUrl: text("attachment_url"),
		attachmentKey: text("attachment_key"),
		attachmentMime: text("attachment_mime"),
		attachmentBytes: integer("attachment_bytes"),
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

// One row per person and item, so busy organizations don't grow a huge log.
export const contentViews = sqliteTable(
	"content_views",
	{
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		targetType: text("target_type", { enum: ["policy", "announcement"] }).notNull(),
		targetId: integer("target_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		viewCount: integer("view_count").notNull().default(1),
		firstViewedAt: integer("first_viewed_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		lastViewedAt: integer("last_viewed_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		// When someone pressed "Got it" on an announcement.
		respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		primaryKey({ columns: [table.targetType, table.targetId, table.userId] }),
		index("content_views_org_idx").on(table.organizationId, table.targetType),
	],
);

export const calendarEvents = sqliteTable(
	"calendar_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		type: text("type", { enum: ["training", "meeting", "deadline", "holiday"] }).notNull(),
		// An all-day event's dates are stored at midnight UTC, and ends on its last day.
		startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
		endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
		allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
		location: text("location"),
		meetingUrl: text("meeting_url"),
		details: text("details"),
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("calendar_events_org_idx").on(table.organizationId, table.startsAt)],
);

// Set by the AidNova team: how far along a module is, and a stop switch for incidents.
export const modulePlatform = sqliteTable("module_platform", {
	moduleKey: text("module_key").primaryKey(),
	release: text("release", { enum: ["coming_soon", "pilot", "available"] })
		.notNull()
		.default("coming_soon"),
	paused: integer("paused", { mode: "boolean" }).notNull().default(false),
	updatedAt: updatedAt(),
});

export const planModules = sqliteTable(
	"plan_modules",
	{
		planId: integer("plan_id")
			.notNull()
			.references(() => subscriptionPlans.id, { onDelete: "cascade" }),
		moduleKey: text("module_key").notNull(),
	},
	(table) => [primaryKey({ columns: [table.planId, table.moduleKey] })],
);

// An organization's own choice. Kept separate from what its plan allows.
export const organizationModules = sqliteTable(
	"organization_modules",
	{
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		moduleKey: text("module_key").notNull(),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
		changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
		changedAt: integer("changed_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		reviewAt: integer("review_at", { mode: "timestamp_ms" }),
		reviewNote: text("review_note"),
		reviewBy: text("review_by").references(() => user.id, { onDelete: "set null" }),
	},
	(table) => [primaryKey({ columns: [table.organizationId, table.moduleKey] })],
);

// A one-off grant from the AidNova team, such as pilot access beyond the plan.
export const moduleOverrides = sqliteTable(
	"module_overrides",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		moduleKey: text("module_key").notNull(),
		until: integer("until", { mode: "timestamp_ms" }),
		note: text("note").notNull(),
		grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [uniqueIndex("module_overrides_unique").on(table.organizationId, table.moduleKey)],
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

// Capacity Building. Records stay between their owner and that owner's reviewers.
export const capacityTeamReviewers = sqliteTable(
	"capacity_team_reviewers",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		departmentId: integer("department_id")
			.notNull()
			.unique()
			.references(() => departments.id, { onDelete: "cascade" }),
		reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
		backupId: text("backup_id").references(() => user.id, { onDelete: "set null" }),
		updatedAt: updatedAt(),
	},
	(table) => [index("capacity_team_reviewers_org_idx").on(table.organizationId)],
);

export const trainingRecords = sqliteTable(
	"training_records",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		category: text("category"),
		isSensitive: integer("is_sensitive", { mode: "boolean" }).notNull().default(false),
		format: text("format", { enum: ["in_person", "online", "hybrid"] }),
		startDate: text("start_date"),
		endDate: text("end_date"),
		durationValue: real("duration_value"),
		durationUnit: text("duration_unit", { enum: ["training_days", "calendar_days", "contact_hours"] })
			.notNull()
			.default("training_days"),
		trainingStatus: text("training_status", {
			enum: ["applied", "started", "in_progress", "completed", "cancelled"],
		})
			.notNull()
			.default("applied"),
		applicationOutcome: text("application_outcome", { enum: ["applied", "accepted", "waitlisted", "declined"] }),
		objectives: text("objectives"),
		provider: text("provider"),
		language: text("language", { enum: ["my", "en", "both"] }).notNull().default("my"),
		// Never a precise place, and no GPS: withheld, a broad region, or online.
		locationMode: text("location_mode", { enum: ["withheld", "region", "online"] }).notNull().default("withheld"),
		region: text("region"),
		reflection: text("reflection"),
		shareReflection: integer("share_reflection", { mode: "boolean" }).notNull().default(false),
		reviewStatus: text("review_status", {
			enum: ["draft", "submitted", "under_review", "verified", "changes_requested", "rejected"],
		})
			.notNull()
			.default("draft"),
		version: integer("version").notNull().default(0),
		submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
		decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
		decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("training_records_owner_idx").on(table.organizationId, table.userId),
		index("training_records_review_idx").on(table.organizationId, table.reviewStatus),
	],
);

export const trainingEvidence = sqliteTable(
	"training_evidence",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		recordId: integer("record_id")
			.notNull()
			.references(() => trainingRecords.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		storageKey: text("storage_key").notNull(),
		uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [
		index("training_evidence_record_idx").on(table.recordId),
		index("training_evidence_org_idx").on(table.organizationId),
	],
);

export const trainingEvents = sqliteTable(
	"training_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		recordId: integer("record_id")
			.notNull()
			.references(() => trainingRecords.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
		kind: text("kind", {
			enum: [
				"submitted",
				"withdrawn",
				"review_started",
				"verified",
				"changes_requested",
				"rejected",
				"message",
				"evidence_viewed",
				"evidence_downloaded",
			],
		}).notNull(),
		message: text("message"),
		// Only reviewers ever get this one back.
		privateNote: text("private_note"),
		version: integer("version").notNull().default(0),
		createdAt: createdAt(),
	},
	(table) => [index("training_events_record_idx").on(table.recordId)],
);

// Projects. Status says where work is, health says how it's going: a project can
// be in progress and at risk at once.
export const projects = sqliteTable(
	"projects",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		code: text("code").notNull(),
		category: text("category"),
		description: text("description"),
		priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
		status: text("status", {
			enum: ["draft", "planned", "in_progress", "on_hold", "completed", "cancelled", "archived"],
		})
			.notNull()
			.default("planned"),
		health: text("health", { enum: ["unknown", "healthy", "needs_attention", "at_risk"] })
			.notNull()
			.default("unknown"),
		healthReason: text("health_reason"),
		healthSetBy: text("health_set_by").references(() => user.id, { onDelete: "set null" }),
		healthSetAt: integer("health_set_at", { mode: "timestamp_ms" }),
		objectives: text("objectives"),
		expectedOutcomes: text("expected_outcomes"),
		startDate: text("start_date"),
		endDate: text("end_date"),
		ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
		managerId: text("manager_id").references(() => user.id, { onDelete: "set null" }),
		visibility: text("visibility", { enum: ["members", "organization"] }).notNull().default("members"),
		funder: text("funder"),
		budgetCurrency: text("budget_currency").notNull().default("USD"),
		budgetAmount: real("budget_amount"),
		beneficiaryTarget: integer("beneficiary_target"),
		locations: text("locations"),
		sdg: integer("sdg"),
		reportingFrequency: text("reporting_frequency", { enum: ["monthly", "quarterly", "custom"] }),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		completedBy: text("completed_by").references(() => user.id, { onDelete: "set null" }),
		completionNotes: text("completion_notes"),
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		uniqueIndex("projects_org_code_idx").on(table.organizationId, table.code),
		index("projects_org_idx").on(table.organizationId),
	],
);

export const projectMembers = sqliteTable(
	"project_members",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role", { enum: ["member", "viewer"] }).notNull().default("member"),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("project_members_unique_idx").on(table.projectId, table.userId),
		index("project_members_user_idx").on(table.organizationId, table.userId),
	],
);

export const projectMilestones = sqliteTable(
	"project_milestones",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		dueDate: text("due_date").notNull(),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		completedBy: text("completed_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [
		index("project_milestones_project_idx").on(table.projectId),
		index("project_milestones_org_idx").on(table.organizationId),
	],
);

export const projectActivity = sqliteTable(
	"project_activity",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
		kind: text("kind").notNull(),
		detail: text("detail"),
		createdAt: createdAt(),
	},
	(table) => [index("project_activity_project_idx").on(table.projectId)],
);

export const projectFolders = sqliteTable(
	"project_folders",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		parentId: integer("parent_id"),
		name: text("name").notNull(),
		createdAt: createdAt(),
	},
	(table) => [index("project_folders_project_idx").on(table.projectId)],
);

// A file is its versions. One linked from the Files library has none of its own.
export const projectFiles = sqliteTable(
	"project_files",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		folderId: integer("folder_id").references(() => projectFolders.id, { onDelete: "set null" }),
		orgFileId: integer("org_file_id").references(() => orgFiles.id, { onDelete: "cascade" }),
		currentVersion: integer("current_version").notNull().default(1),
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("project_files_project_idx").on(table.projectId)],
);

export const projectFileVersions = sqliteTable(
	"project_file_versions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		fileId: integer("file_id")
			.notNull()
			.references(() => projectFiles.id, { onDelete: "cascade" }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		name: text("name").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		storageKey: text("storage_key").notNull(),
		note: text("note"),
		// A restored version shares the older one's stored file, so it isn't counted twice.
		restoredFrom: integer("restored_from"),
		uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("project_file_versions_unique_idx").on(table.fileId, table.version),
		index("project_file_versions_project_idx").on(table.projectId),
		index("project_file_versions_org_idx").on(table.organizationId),
	],
);

export const projectReports = sqliteTable(
	"project_reports",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		type: text("type", { enum: ["form", "file"] }).notNull().default("form"),
		// A month (2026-09) or quarter (2026-Q3) for a form. An uploaded report has a label.
		period: text("period").notNull(),
		label: text("label"),
		status: text("status", { enum: ["draft", "submitted", "needs_revision", "approved", "locked"] })
			.notNull()
			.default("draft"),
		revision: integer("revision").notNull().default(1),
		beneficiaries: integer("beneficiaries"),
		activities: text("activities"),
		budgetSpent: real("budget_spent"),
		challenges: text("challenges"),
		nextPlan: text("next_plan"),
		fileId: integer("file_id").references(() => projectFiles.id, { onDelete: "set null" }),
		reviewComment: text("review_comment"),
		reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
		reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
		submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
		submittedBy: text("submitted_by").references(() => user.id, { onDelete: "set null" }),
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("project_reports_project_idx").on(table.projectId)],
);

export const projectReportFiles = sqliteTable(
	"project_report_files",
	{
		reportId: integer("report_id")
			.notNull()
			.references(() => projectReports.id, { onDelete: "cascade" }),
		fileId: integer("file_id")
			.notNull()
			.references(() => projectFiles.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.reportId, table.fileId] })],
);

// A published number and where it came from. It stays as checked, even when a newer
// version of the file arrives, until someone publishes again.
export const projectWidgets = sqliteTable(
	"project_widgets",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		fileId: integer("file_id").references(() => projectFiles.id, { onDelete: "set null" }),
		fileVersion: integer("file_version").notNull(),
		fileName: text("file_name").notNull(),
		kind: text("kind", { enum: ["kpi_total", "bar", "line", "donut", "kpi_growth"] }).notNull(),
		title: text("title").notNull(),
		series: text("series").notNull(),
		checkedBy: text("checked_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [index("project_widgets_project_idx").on(table.projectId)],
);

// Skills an organization recognizes, each with its own rubric for the five levels.
export const capacitySkills = sqliteTable(
	"capacity_skills",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		category: text("category"),
		description: text("description"),
		revalidateMonths: integer("revalidate_months"),
		rubric: text("rubric").notNull(),
		rubricVersion: integer("rubric_version").notNull().default(1),
		retired: integer("retired", { mode: "boolean" }).notNull().default(false),
		// Set when a staff member added it while nominating, rather than an admin.
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [index("capacity_skills_org_idx").on(table.organizationId)],
);

// Level is only ever set by an assessor. A nomination waits in pendingLevel.
export const capacityUserSkills = sqliteTable(
	"capacity_user_skills",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		skillId: integer("skill_id")
			.notNull()
			.references(() => capacitySkills.id, { onDelete: "cascade" }),
		level: integer("level"),
		pendingLevel: integer("pending_level"),
		evidence: text("evidence"),
		nominatedAt: integer("nominated_at", { mode: "timestamp_ms" }),
		feedback: text("feedback"),
		privateNote: text("private_note"),
		assessedBy: text("assessed_by").references(() => user.id, { onDelete: "set null" }),
		assessedAt: integer("assessed_at", { mode: "timestamp_ms" }),
		rubricVersion: integer("rubric_version"),
		shared: integer("shared", { mode: "boolean" }).notNull().default(false),
	},
	(table) => [
		uniqueIndex("capacity_user_skills_unique_idx").on(table.userId, table.skillId),
		index("capacity_user_skills_org_idx").on(table.organizationId),
	],
);

export const capacityBadgeShares = sqliteTable(
	"capacity_badge_shares",
	{
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		badgeKey: text("badge_key").notNull(),
	},
	(table) => [primaryKey({ columns: [table.organizationId, table.userId, table.badgeKey] })],
);

// Nobody is in the directory unless they've turned this on themselves.
export const directoryProfiles = sqliteTable(
	"directory_profiles",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		organizationId: integer("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		listed: integer("listed", { mode: "boolean" }).notNull().default(false),
		displayName: text("display_name"),
		displayNameApproved: integer("display_name_approved", { mode: "boolean" }).notNull().default(false),
		picture: text("picture", { enum: ["photo", "initials", "pattern"] }).notNull().default("initials"),
		showTitle: integer("show_title", { mode: "boolean" }).notNull().default(true),
		showTeam: integer("show_team", { mode: "boolean" }).notNull().default(false),
		bio: text("bio"),
	},
	(table) => [uniqueIndex("directory_profiles_unique_idx").on(table.organizationId, table.userId)],
);

export const directorySettings = sqliteTable("directory_settings", {
	organizationId: integer("organization_id")
		.primaryKey()
		.references(() => organizations.id, { onDelete: "cascade" }),
	showTeams: integer("show_teams", { mode: "boolean" }).notNull().default(false),
	allowPhotos: integer("allow_photos", { mode: "boolean" }).notNull().default(false),
	allowDisplayNames: integer("allow_display_names", { mode: "boolean" }).notNull().default(true),
});
