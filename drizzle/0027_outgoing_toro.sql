ALTER TABLE `attachment` ADD `source_checkout_id` varchar(36);--> statement-breakpoint
ALTER TABLE `attachment` ADD CONSTRAINT `attachment_source_checkout_id_checkout_id_fk` FOREIGN KEY (`source_checkout_id`) REFERENCES `checkout`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attachment_org_checkout_idx` ON `attachment` (`organization_id`,`source_checkout_id`);