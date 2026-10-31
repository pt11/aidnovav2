CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`location` text,
	`meeting_url` text,
	`details` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `calendar_events_org_idx` ON `calendar_events` (`organization_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `module_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`until` integer,
	`note` text NOT NULL,
	`granted_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `module_overrides_unique` ON `module_overrides` (`organization_id`,`module_key`);--> statement-breakpoint
CREATE TABLE `module_platform` (
	`module_key` text PRIMARY KEY NOT NULL,
	`release` text DEFAULT 'coming_soon' NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organization_modules` (
	`organization_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`changed_by` text,
	`changed_at` integer NOT NULL,
	`review_at` integer,
	`review_note` text,
	`review_by` text,
	PRIMARY KEY(`organization_id`, `module_key`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`review_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `plan_modules` (
	`plan_id` integer NOT NULL,
	`module_key` text NOT NULL,
	PRIMARY KEY(`plan_id`, `module_key`),
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `plan_modules` (`plan_id`, `module_key`) SELECT `id`, 'projects' FROM `subscription_plans` WHERE `name` IN ('Basic', 'Plus');
--> statement-breakpoint
INSERT INTO `plan_modules` (`plan_id`, `module_key`) SELECT `id`, 'capacity_building' FROM `subscription_plans` WHERE `name` = 'Plus';
--> statement-breakpoint
INSERT INTO `plan_modules` (`plan_id`, `module_key`) SELECT `id`, 'people_directory' FROM `subscription_plans` WHERE `name` = 'Plus';
--> statement-breakpoint
INSERT INTO `module_platform` (`module_key`, `updated_at`) VALUES ('projects', unixepoch() * 1000), ('capacity_building', unixepoch() * 1000), ('people_directory', unixepoch() * 1000);
