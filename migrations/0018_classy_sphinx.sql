CREATE TABLE `project_widgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`file_id` integer,
	`file_version` integer NOT NULL,
	`file_name` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`series` text NOT NULL,
	`checked_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `project_files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checked_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_widgets_project_idx` ON `project_widgets` (`project_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `completed_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `projects` ADD `completion_notes` text;