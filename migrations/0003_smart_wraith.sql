CREATE TABLE `file_access_departments` (
	`file_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	PRIMARY KEY(`file_id`, `department_id`),
	FOREIGN KEY (`file_id`) REFERENCES `org_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `file_access_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_file_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` integer NOT NULL,
	`action` text DEFAULT 'view' NOT NULL,
	`accessed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_file_id`) REFERENCES `org_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_access_log_org_idx` ON `file_access_log` (`organization_id`);--> statement-breakpoint
CREATE INDEX `file_access_log_user_idx` ON `file_access_log` (`user_id`,`action`);--> statement-breakpoint
CREATE TABLE `folder_access_departments` (
	`folder_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	PRIMARY KEY(`folder_id`, `department_id`),
	FOREIGN KEY (`folder_id`) REFERENCES `hub_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hub_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_by` text,
	`pin_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `hub_folders_org_idx` ON `hub_folders` (`organization_id`);--> statement-breakpoint
CREATE TABLE `org_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`storage_key` text,
	`url` text,
	`name` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`file_type` text DEFAULT 'upload' NOT NULL,
	`uploaded_by` text,
	`pin_hash` text,
	`folder_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`folder_id`) REFERENCES `hub_folders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `org_files_org_idx` ON `org_files` (`organization_id`);--> statement-breakpoint
CREATE INDEX `org_files_folder_idx` ON `org_files` (`folder_id`);