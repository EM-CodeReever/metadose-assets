ALTER TABLE `checkout_request` DROP FOREIGN KEY `checkout_request_fulfilled_checkout_id_checkout_id_fk`;
--> statement-breakpoint
ALTER TABLE `checkout_request` ADD CONSTRAINT `checkout_request_fulfilled_checkout_id_checkout_id_fk` FOREIGN KEY (`fulfilled_checkout_id`) REFERENCES `checkout`(`id`) ON DELETE set null ON UPDATE no action;