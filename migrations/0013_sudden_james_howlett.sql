CREATE TABLE `capacity_team_reviewers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	`reviewer_id` text,
	`backup_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`backup_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capacity_team_reviewers_department_id_unique` ON `capacity_team_reviewers` (`department_id`);--> statement-breakpoint
CREATE INDEX `capacity_team_reviewers_org_idx` ON `capacity_team_reviewers` (`organization_id`);--> statement-breakpoint
CREATE TABLE `training_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`actor_id` text,
	`kind` text NOT NULL,
	`message` text,
	`private_note` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_events_record_idx` ON `training_events` (`record_id`);--> statement-breakpoint
CREATE TABLE `training_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `training_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_evidence_record_idx` ON `training_evidence` (`record_id`);--> statement-breakpoint
CREATE INDEX `training_evidence_org_idx` ON `training_evidence` (`organization_id`);--> statement-breakpoint
CREATE TABLE `training_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`is_sensitive` integer DEFAULT false NOT NULL,
	`format` text,
	`start_date` text,
	`end_date` text,
	`duration_value` real,
	`duration_unit` text DEFAULT 'training_days' NOT NULL,
	`training_status` text DEFAULT 'applied' NOT NULL,
	`application_outcome` text,
	`objectives` text,
	`provider` text,
	`language` text DEFAULT 'my' NOT NULL,
	`location_mode` text DEFAULT 'withheld' NOT NULL,
	`region` text,
	`reflection` text,
	`share_reflection` integer DEFAULT false NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`submitted_at` integer,
	`decided_at` integer,
	`decided_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `training_records_owner_idx` ON `training_records` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `training_records_review_idx` ON `training_records` (`organization_id`,`review_status`);