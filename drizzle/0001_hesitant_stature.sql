CREATE TABLE `field_definition` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`object_type_id` varchar(36) NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`data_type` enum('text','number','date','boolean','select','user_reference') NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`default_value` json,
	`select_options` json,
	`filterable` boolean NOT NULL DEFAULT false,
	`reportable` boolean NOT NULL DEFAULT false,
	`storage_slot` varchar(20),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_builtin` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `field_definition_id` PRIMARY KEY(`id`),
	CONSTRAINT `field_definition_type_key_uq` UNIQUE(`object_type_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `object_type` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`icon` varchar(50),
	`description` text,
	`builtin_kind` enum('it_asset','consumable','cable','custom') NOT NULL DEFAULT 'custom',
	`is_archived` boolean NOT NULL DEFAULT false,
	`created_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `object_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `object_type_org_slug_uq` UNIQUE(`organization_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `field_definition` ADD CONSTRAINT `field_definition_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_definition` ADD CONSTRAINT `field_definition_object_type_id_object_type_id_fk` FOREIGN KEY (`object_type_id`) REFERENCES `object_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `object_type` ADD CONSTRAINT `object_type_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `object_type` ADD CONSTRAINT `object_type_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `field_definition_org_type_idx` ON `field_definition` (`organization_id`,`object_type_id`);--> statement-breakpoint
CREATE INDEX `object_type_org_idx` ON `object_type` (`organization_id`);