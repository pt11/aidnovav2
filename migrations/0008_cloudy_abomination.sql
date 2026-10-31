CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	`failed_verification_count` integer DEFAULT 0,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `two_factor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `two_factor_user_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `logo_key` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `logo_type` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `logo_bytes` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `two_factor_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `photo_key` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `photo_type` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `photo_bytes` integer;