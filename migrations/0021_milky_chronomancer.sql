CREATE TABLE `notification_settings` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`policies` integer DEFAULT true NOT NULL,
	`courses` integer DEFAULT true NOT NULL,
	`announcements` integer DEFAULT true NOT NULL,
	`events` integer DEFAULT true NOT NULL,
	`welcome` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`href` text NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_person_idx` ON `notifications` (`user_id`,`organization_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `assistant_enabled` integer DEFAULT true NOT NULL;