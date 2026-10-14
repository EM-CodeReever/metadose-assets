CREATE TABLE `location` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`parent_location_id` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `location_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checkout` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`record_id` varchar(36) NOT NULL,
	`assigned_to_type` enum('user','location') NOT NULL,
	`assigned_to_user_id` varchar(36),
	`assigned_to_location_id` varchar(36),
	`checked_out_by` varchar(36) NOT NULL,
	`checked_out_at` timestamp(3) NOT NULL DEFAULT (now()),
	`due_at` timestamp(3),
	`checked_in_at` timestamp(3),
	`checked_in_by` varchar(36),
	`notes` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `checkout_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`record_id` varchar(36),
	`object_type_id` varchar(36),
	`actor_user_id` varchar(36),
	`action` varchar(50) NOT NULL,
	`summary` text,
	`changes` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_record_id_record_id_fk` FOREIGN KEY (`record_id`) REFERENCES `record`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_assigned_to_user_id_user_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_assigned_to_location_id_location_id_fk` FOREIGN KEY (`assigned_to_location_id`) REFERENCES `location`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_checked_out_by_user_id_fk` FOREIGN KEY (`checked_out_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout` ADD CONSTRAINT `checkout_checked_in_by_user_id_fk` FOREIGN KEY (`checked_in_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_record_id_record_id_fk` FOREIGN KEY (`record_id`) REFERENCES `record`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_object_type_id_object_type_id_fk` FOREIGN KEY (`object_type_id`) REFERENCES `object_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `location_org_idx` ON `location` (`organization_id`);--> statement-breakpoint
CREATE INDEX `checkout_org_record_open_idx` ON `checkout` (`organization_id`,`record_id`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `checkout_org_user_idx` ON `checkout` (`organization_id`,`assigned_to_user_id`);--> statement-breakpoint
CREATE INDEX `checkout_org_location_idx` ON `checkout` (`organization_id`,`assigned_to_location_id`);--> statement-breakpoint
CREATE INDEX `activity_org_record_created_idx` ON `activity_log` (`organization_id`,`record_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_org_created_idx` ON `activity_log` (`organization_id`,`created_at`);