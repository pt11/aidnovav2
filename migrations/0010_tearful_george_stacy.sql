CREATE TABLE `content_views` (
	`organization_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`view_count` integer DEFAULT 1 NOT NULL,
	`first_viewed_at` integer NOT NULL,
	`last_viewed_at` integer NOT NULL,
	`responded_at` integer,
	PRIMARY KEY(`target_type`, `target_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_views_org_idx` ON `content_views` (`organization_id`,`target_type`);