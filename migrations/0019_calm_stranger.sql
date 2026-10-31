CREATE TABLE `capacity_badge_shares` (
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`badge_key` text NOT NULL,
	PRIMARY KEY(`organization_id`, `user_id`, `badge_key`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `capacity_skills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`revalidate_months` integer,
	`rubric` text NOT NULL,
	`rubric_version` integer DEFAULT 1 NOT NULL,
	`retired` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `capacity_skills_org_idx` ON `capacity_skills` (`organization_id`);--> statement-breakpoint
CREATE TABLE `capacity_user_skills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` integer NOT NULL,
	`level` integer,
	`pending_level` integer,
	`evidence` text,
	`nominated_at` integer,
	`feedback` text,
	`private_note` text,
	`assessed_by` text,
	`assessed_at` integer,
	`rubric_version` integer,
	`shared` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `capacity_skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assessed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capacity_user_skills_unique_idx` ON `capacity_user_skills` (`user_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `capacity_user_skills_org_idx` ON `capacity_user_skills` (`organization_id`);--> statement-breakpoint
CREATE TABLE `directory_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`listed` integer DEFAULT false NOT NULL,
	`display_name` text,
	`display_name_approved` integer DEFAULT false NOT NULL,
	`picture` text DEFAULT 'initials' NOT NULL,
	`show_title` integer DEFAULT true NOT NULL,
	`show_team` integer DEFAULT false NOT NULL,
	`bio` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `directory_profiles_unique_idx` ON `directory_profiles` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `directory_settings` (
	`organization_id` integer PRIMARY KEY NOT NULL,
	`show_teams` integer DEFAULT false NOT NULL,
	`allow_photos` integer DEFAULT false NOT NULL,
	`allow_display_names` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
