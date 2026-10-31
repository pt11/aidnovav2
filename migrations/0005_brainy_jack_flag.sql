CREATE TABLE `subscription_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`monthly_price` integer DEFAULT 0 NOT NULL,
	`yearly_price` integer DEFAULT 0 NOT NULL,
	`max_users` integer,
	`storage_limit_gb` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upgrade_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`requested_by` text,
	`plan_id` integer,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`extra_user_blocks` integer DEFAULT 0 NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upgrade_requests_one_pending` ON `upgrade_requests` (`organization_id`) WHERE "upgrade_requests"."status" = 'pending';--> statement-breakpoint
ALTER TABLE `organizations` ADD `plan_id` integer REFERENCES subscription_plans(id);--> statement-breakpoint
ALTER TABLE `organizations` ADD `extra_user_blocks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `custom_max_users` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `custom_storage_gb` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `paid_until` integer;--> statement-breakpoint
INSERT INTO `subscription_plans` (`name`, `description`, `monthly_price`, `yearly_price`, `max_users`, `storage_limit_gb`, `sort_order`) VALUES ('Basic', 'For smaller teams.', 3000, 30000, 50, 25, 1), ('Plus', 'For growing organizations.', 6000, 60000, 100, 50, 2);
