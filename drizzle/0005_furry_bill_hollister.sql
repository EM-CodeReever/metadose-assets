CREATE TABLE `report_definition` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`object_type_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`config` json NOT NULL,
	`created_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `report_definition_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `report_definition` ADD CONSTRAINT `report_definition_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_definition` ADD CONSTRAINT `report_definition_object_type_id_object_type_id_fk` FOREIGN KEY (`object_type_id`) REFERENCES `object_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_definition` ADD CONSTRAINT `report_definition_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `report_org_type_idx` ON `report_definition` (`organization_id`,`object_type_id`);