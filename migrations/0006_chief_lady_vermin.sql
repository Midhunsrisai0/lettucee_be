CREATE TABLE `chitti` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`edge` text NOT NULL,
	`destination` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chitti_source_idx` ON `chitti` (`source`);--> statement-breakpoint
CREATE INDEX `chitti_destination_idx` ON `chitti` (`destination`);--> statement-breakpoint
CREATE TABLE `pandu` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`adjacency_list` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
