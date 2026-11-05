CREATE TABLE `ai_organization_limits` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`per_day` integer,
	`per_week` integer,
	`per_month` integer,
	`per_person_day` integer,
	`note` text,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `ai_platform` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`trial_per_day` integer DEFAULT 40,
	`trial_per_week` integer DEFAULT 150,
	`trial_per_month` integer DEFAULT 300,
	`trial_per_person_day` integer DEFAULT 10,
	`per_extra_block` integer DEFAULT 300 NOT NULL,
	`updated_by` text,
	`updated_at` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `ai_per_day` integer DEFAULT 80;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `ai_per_week` integer DEFAULT 300;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `ai_per_month` integer DEFAULT 1000;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD `ai_per_person_day` integer DEFAULT 20;--> statement-breakpoint
INSERT INTO `ai_platform` (`id`) VALUES (1);--> statement-breakpoint
UPDATE `subscription_plans` SET `ai_per_day` = 150, `ai_per_week` = 600, `ai_per_month` = 2000, `ai_per_person_day` = 30 WHERE `name` = 'Plus';
