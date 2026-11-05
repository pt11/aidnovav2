CREATE TABLE `addon_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`addon_key` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `addon_requests_status_idx` ON `addon_requests` (`status`,`organization_id`);--> statement-breakpoint
CREATE TABLE `addons` (
	`key` text PRIMARY KEY NOT NULL,
	`monthly_price` integer DEFAULT 0 NOT NULL,
	`yearly_price` integer DEFAULT 0 NOT NULL,
	`unit_size` integer,
	`on_sale` integer DEFAULT false NOT NULL,
	`updated_by` text,
	`updated_at` integer,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `organization_addons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`addon_key` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`ends_at` integer,
	`note` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`cancelled_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `organization_addons_org_idx` ON `organization_addons` (`organization_id`,`status`);--> statement-breakpoint
INSERT INTO `addons` (`key`, `unit_size`) VALUES ('module:projects', NULL), ('module:capacity_building', NULL), ('module:people_directory', NULL), ('ai:messages', 1000);
