ALTER TABLE `users` ADD `country_code` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone_number` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `username` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `has_super_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `full_name`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `approved_by`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `approved_at`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `rejected_reason`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `is_admin`;