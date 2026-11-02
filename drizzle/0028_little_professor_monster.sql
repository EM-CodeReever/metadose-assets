CREATE TABLE `maintenance_check` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`record_id` varchar(36) NOT NULL,
	`performed_by` varchar(36),
	`performed_at` timestamp(3) NOT NULL DEFAULT (now()),
	`condition_id` varchar(36),
	`note` text NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenance_check_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `object_type` ADD `maintenance_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `record` ADD `maintenance_interval_days` int;--> statement-breakpoint
ALTER TABLE `record` ADD `maintenance_due_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `record` ADD `last_maintenance_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `record` ADD `maintenance_last_notified_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `maintenance_check` ADD CONSTRAINT `maintenance_check_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_check` ADD CONSTRAINT `maintenance_check_record_id_record_id_fk` FOREIGN KEY (`record_id`) REFERENCES `record`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_check` ADD CONSTRAINT `maintenance_check_performed_by_user_id_fk` FOREIGN KEY (`performed_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_check` ADD CONSTRAINT `maintenance_check_condition_id_lookup_value_id_fk` FOREIGN KEY (`condition_id`) REFERENCES `lookup_value`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `maintenance_check_org_record_idx` ON `maintenance_check` (`organization_id`,`record_id`);--> statement-breakpoint
CREATE INDEX `record_maintenance_due_idx` ON `record` (`organization_id`,`object_type_id`,`maintenance_due_at`);