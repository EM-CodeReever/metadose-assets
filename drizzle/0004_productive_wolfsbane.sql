CREATE TABLE `attachment` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`record_id` varchar(36) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`mime_type` varchar(150) NOT NULL,
	`size_bytes` int unsigned NOT NULL,
	`storage_backend` enum('local','s3') NOT NULL DEFAULT 'local',
	`storage_key` varchar(500) NOT NULL,
	`uploaded_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `attachment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `attachment` ADD CONSTRAINT `attachment_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachment` ADD CONSTRAINT `attachment_record_id_record_id_fk` FOREIGN KEY (`record_id`) REFERENCES `record`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachment` ADD CONSTRAINT `attachment_uploaded_by_user_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attachment_org_record_idx` ON `attachment` (`organization_id`,`record_id`);