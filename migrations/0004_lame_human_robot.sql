CREATE TABLE `userconfig` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`has_super_access` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `userconfig_user_id_unique` ON `userconfig` (`user_id`);--> statement-breakpoint
INSERT INTO `userconfig` (`id`, `user_id`, `is_admin`, `has_super_access`)
SELECT lower(hex(randomblob(16))), `id`, false, `has_super_access`
FROM `users`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `has_super_access`;