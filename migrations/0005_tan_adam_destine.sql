CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`approvee` text NOT NULL,
	`approver` text NOT NULL,
	`super_access_given` integer NOT NULL,
	`super_access_reason` text,
	`comments` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`approvee`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
