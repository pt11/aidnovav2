CREATE TABLE `certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`course_id` integer,
	`user_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`course_title` text NOT NULL,
	`organization_name` text NOT NULL,
	`score` integer,
	`code` text NOT NULL,
	`issued_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_course_user` ON `certificates` (`course_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `certificates_user_idx` ON `certificates` (`user_id`);--> statement-breakpoint
CREATE TABLE `course_enrollments` (
	`course_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`is_assigned` integer DEFAULT false NOT NULL,
	`assigned_by` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`course_id`, `user_id`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `course_enrollments_user_idx` ON `course_enrollments` (`user_id`);--> statement-breakpoint
CREATE TABLE `course_lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`module_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`video_url` text,
	`completion_method` text DEFAULT 'mark' NOT NULL,
	`estimated_time` text,
	`is_required` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `course_lessons_course_idx` ON `course_lessons` (`course_id`);--> statement-breakpoint
CREATE INDEX `course_lessons_module_idx` ON `course_lessons` (`module_id`);--> statement-breakpoint
CREATE TABLE `course_modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `course_modules_course_idx` ON `course_modules` (`course_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`objectives` text,
	`duration` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`cover_key` text,
	`cover_type` text,
	`cover_bytes` integer,
	`quiz_title` text,
	`passing_score` integer DEFAULT 80 NOT NULL,
	`certificate_enabled` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `courses_org_idx` ON `courses` (`organization_id`);--> statement-breakpoint
CREATE TABLE `lesson_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`lesson_id` integer NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer,
	`storage_key` text,
	`file_id` integer,
	`upload_id` text,
	`is_required` integer DEFAULT false NOT NULL,
	`page_count` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `course_lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `org_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lesson_materials_lesson_idx` ON `lesson_materials` (`lesson_id`);--> statement-breakpoint
CREATE INDEX `lesson_materials_org_idx` ON `lesson_materials` (`organization_id`);--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`lesson_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	PRIMARY KEY(`lesson_id`, `user_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `course_lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lesson_progress_course_idx` ON `lesson_progress` (`course_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `material_progress` (
	`material_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`viewed_pages` text DEFAULT '[]' NOT NULL,
	`completed_at` integer,
	PRIMARY KEY(`material_id`, `user_id`),
	FOREIGN KEY (`material_id`) REFERENCES `lesson_materials`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL,
	`correct` integer NOT NULL,
	`total` integer NOT NULL,
	`passed` integer NOT NULL,
	`review` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_course_idx` ON `quiz_attempts` (`course_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`question` text NOT NULL,
	`type` text NOT NULL,
	`options` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_questions_course_idx` ON `quiz_questions` (`course_id`);