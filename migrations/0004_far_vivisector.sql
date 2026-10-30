CREATE TABLE `assistant_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assistant_usage_org_idx` ON `assistant_usage` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `assistant_usage_user_idx` ON `assistant_usage` (`user_id`,`created_at`);