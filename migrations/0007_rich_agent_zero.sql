ALTER TABLE `course_lessons` ADD `lesson_type` text DEFAULT 'reading' NOT NULL;--> statement-breakpoint
ALTER TABLE `lesson_materials` ADD `sort_order` integer DEFAULT 0 NOT NULL;