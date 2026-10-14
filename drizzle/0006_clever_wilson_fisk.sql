ALTER TABLE `object_type` MODIFY COLUMN `builtin_kind` enum('it_asset','asset','accessory','consumable','component','cable','custom') NOT NULL DEFAULT 'custom';--> statement-breakpoint
UPDATE `object_type` SET `builtin_kind` = 'asset' WHERE `builtin_kind` = 'it_asset';--> statement-breakpoint
UPDATE `object_type` SET `builtin_kind` = 'custom' WHERE `builtin_kind` = 'cable';--> statement-breakpoint
ALTER TABLE `object_type` MODIFY COLUMN `builtin_kind` enum('asset','accessory','consumable','component','custom') NOT NULL DEFAULT 'custom';--> statement-breakpoint
ALTER TABLE `checkout` MODIFY COLUMN `assigned_to_type` enum('user','location','asset') NOT NULL;--> statement-breakpoint
ALTER TABLE `field_definition` ADD `locked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `field_definition` ADD `system_managed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout` ADD `quantity` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout` ADD `assigned_to_record_id` varchar(36);--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_assigned_to_record_id_record_id_fk` FOREIGN KEY (`assigned_to_record_id`) REFERENCES `record`(`id`) ON DELETE no action ON UPDATE no action;