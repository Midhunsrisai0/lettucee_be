CREATE TABLE `contacts` (
	`from_hash` text NOT NULL,
	`to_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`from_hash`, `to_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_from` ON `contacts` (`from_hash`);--> statement-breakpoint
CREATE INDEX `idx_contacts_to` ON `contacts` (`to_hash`);--> statement-breakpoint
CREATE TABLE `pending_contacts` (
	`from_hash` text NOT NULL,
	`to_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`from_hash`, `to_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_pending_to` ON `pending_contacts` (`to_hash`);--> statement-breakpoint
CREATE TABLE `mutuals` (
	`user_a` text NOT NULL,
	`user_b` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_a`, `user_b`)
);
--> statement-breakpoint
CREATE INDEX `idx_mutuals_a` ON `mutuals` (`user_a`);--> statement-breakpoint
CREATE INDEX `idx_mutuals_b` ON `mutuals` (`user_b`);--> statement-breakpoint
ALTER TABLE `users` ADD `phone_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_hash_unique` ON `users` (`phone_hash`);