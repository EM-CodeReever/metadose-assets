CREATE TABLE `lookup_value` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`kind` enum('manufacturer','category','condition') NOT NULL,
	`name` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `lookup_value_id` PRIMARY KEY(`id`),
	CONSTRAINT `lookup_value_org_kind_name_uq` UNIQUE(`organization_id`,`kind`,`name`)
);
--> statement-breakpoint
ALTER TABLE `field_definition` MODIFY COLUMN `data_type` enum('text','number','date','boolean','select','user_reference','reference') NOT NULL;--> statement-breakpoint
ALTER TABLE `field_definition` ADD `reference_kind` enum('manufacturer','category','condition');--> statement-breakpoint
ALTER TABLE `lookup_value` ADD CONSTRAINT `lookup_value_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lookup_value_org_kind_idx` ON `lookup_value` (`organization_id`,`kind`);