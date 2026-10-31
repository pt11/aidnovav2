CREATE TABLE `project_file_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` integer NOT NULL,
	`project_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`note` text,
	`restored_from` integer,
	`uploaded_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `project_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_file_versions_unique_idx` ON `project_file_versions` (`file_id`,`version`);--> statement-breakpoint
CREATE INDEX `project_file_versions_project_idx` ON `project_file_versions` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_file_versions_org_idx` ON `project_file_versions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `project_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`folder_id` integer,
	`org_file_id` integer,
	`current_version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `project_folders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`org_file_id`) REFERENCES `org_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_files_project_idx` ON `project_files` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_folders_project_idx` ON `project_folders` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_report_files` (
	`report_id` integer NOT NULL,
	`file_id` integer NOT NULL,
	PRIMARY KEY(`report_id`, `file_id`),
	FOREIGN KEY (`report_id`) REFERENCES `project_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `project_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`type` text DEFAULT 'form' NOT NULL,
	`period` text NOT NULL,
	`label` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`beneficiaries` integer,
	`activities` text,
	`budget_spent` real,
	`challenges` text,
	`next_plan` text,
	`file_id` integer,
	`review_comment` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`submitted_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `project_files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_reports_project_idx` ON `project_reports` (`project_id`);