ALTER TABLE `users` ADD COLUMN `account_status` text DEFAULT 'active' NOT NULL;
ALTER TABLE `users` ADD COLUMN `pix_key` text;
ALTER TABLE `users` ADD COLUMN `pix_key_set_at` integer;
ALTER TABLE `users` ADD COLUMN `allow_pix_key_edit` integer DEFAULT 0 NOT NULL;
