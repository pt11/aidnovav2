CREATE TABLE `policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`effective_date` integer,
	`review_date` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`organization_id` integer NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `policies_org_idx` ON `policies` (`organization_id`);--> statement-breakpoint
CREATE TABLE `policy_access_departments` (
	`policy_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	PRIMARY KEY(`policy_id`, `department_id`),
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `policy_acknowledgments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`policy_version` integer DEFAULT 1 NOT NULL,
	`acknowledged_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policy_acks_unique` ON `policy_acknowledgments` (`policy_id`,`user_id`,`policy_version`);--> statement-breakpoint
CREATE INDEX `policy_acks_user_idx` ON `policy_acknowledgments` (`user_id`);--> statement-breakpoint
CREATE TABLE `policy_reminder_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`sent_by` text,
	`sent_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sent_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `policy_reminders_policy_idx` ON `policy_reminder_log` (`policy_id`);