ALTER TABLE `users` ADD COLUMN `cpf` text;
--> statement-breakpoint
ALTER TABLE `deposits` ADD COLUMN `pix_copy_paste` text;
--> statement-breakpoint
ALTER TABLE `deposits` ADD COLUMN `qr_code_base64` text;
--> statement-breakpoint
ALTER TABLE `deposits` ADD COLUMN `gateway_transaction_id` text;
--> statement-breakpoint
ALTER TABLE `package_pix_orders` ADD COLUMN `gateway_transaction_id` text;
--> statement-breakpoint
ALTER TABLE `withdrawals` ADD COLUMN `external_ref` text;
--> statement-breakpoint
ALTER TABLE `withdrawals` ADD COLUMN `gateway_transaction_id` text;
--> statement-breakpoint
CREATE INDEX `package_pix_orders_gateway_tx_idx` ON `package_pix_orders` (`gateway_transaction_id`);
