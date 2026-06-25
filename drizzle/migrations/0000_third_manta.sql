CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_label` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `binary_tree_nodes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`side` text,
	`placed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `binary_tree_nodes_parent_id_idx` ON `binary_tree_nodes` (`parent_id`);--> statement-breakpoint
CREATE TABLE `deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`method` text DEFAULT 'pix' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`external_ref` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deposits_user_id_idx` ON `deposits` (`user_id`);--> statement-breakpoint
CREATE TABLE `investment_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`min_amount` real NOT NULL,
	`max_amount` real NOT NULL,
	`daily_yield_pct` real NOT NULL,
	`term_days` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bucket` text NOT NULL,
	`entry_type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`reference_type` text,
	`reference_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ledger_entries_user_id_idx` ON `ledger_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `ledger_entries_created_at_idx` ON `ledger_entries` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount` real,
	`renews_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_id_uidx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_id` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`term_ends_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `investment_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_packages_user_id_idx` ON `user_packages` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`referral_code` text NOT NULL,
	`sponsor_id` text,
	`qualification` text DEFAULT 'bronze' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uidx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_referral_code_uidx` ON `users` (`referral_code`);--> statement-breakpoint
CREATE INDEX `users_sponsor_id_idx` ON `users` (`sponsor_id`);--> statement-breakpoint
CREATE TABLE `wallet_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bucket` text NOT NULL,
	`available_balance` real DEFAULT 0 NOT NULL,
	`blocked_balance` real DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_accounts_user_bucket_uidx` ON `wallet_accounts` (`user_id`,`bucket`);--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`bucket` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`pix_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `withdrawals_user_id_idx` ON `withdrawals` (`user_id`);