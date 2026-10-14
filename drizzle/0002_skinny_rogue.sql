CREATE TABLE `record` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`object_type_id` varchar(36) NOT NULL,
	`data` json NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'available',
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`deleted_at` timestamp(3),
	`text_1` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_1'))) STORED,
	`text_2` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_2'))) STORED,
	`text_3` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_3'))) STORED,
	`text_4` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_4'))) STORED,
	`text_5` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_5'))) STORED,
	`text_6` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_6'))) STORED,
	`text_7` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_7'))) STORED,
	`text_8` varchar(500) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.text_8'))) STORED,
	`number_1` decimal(20,4) GENERATED ALWAYS AS (cast(json_extract(`data`, '$.slots.number_1') as decimal(20,4))) STORED,
	`number_2` decimal(20,4) GENERATED ALWAYS AS (cast(json_extract(`data`, '$.slots.number_2') as decimal(20,4))) STORED,
	`number_3` decimal(20,4) GENERATED ALWAYS AS (cast(json_extract(`data`, '$.slots.number_3') as decimal(20,4))) STORED,
	`number_4` decimal(20,4) GENERATED ALWAYS AS (cast(json_extract(`data`, '$.slots.number_4') as decimal(20,4))) STORED,
	`date_1` datetime GENERATED ALWAYS AS (cast(json_unquote(json_extract(`data`, '$.slots.date_1')) as datetime)) STORED,
	`date_2` datetime GENERATED ALWAYS AS (cast(json_unquote(json_extract(`data`, '$.slots.date_2')) as datetime)) STORED,
	`date_3` datetime GENERATED ALWAYS AS (cast(json_unquote(json_extract(`data`, '$.slots.date_3')) as datetime)) STORED,
	`date_4` datetime GENERATED ALWAYS AS (cast(json_unquote(json_extract(`data`, '$.slots.date_4')) as datetime)) STORED,
	`bool_1` boolean GENERATED ALWAYS AS (cast(json_extract(`data`, '$.slots.bool_1') as unsigned)) STORED,
	`bool_2` boolean GENERATED ALWAYS AS (cast(json_extract(`data`, '$.slots.bool_2') as unsigned)) STORED,
	`select_1` varchar(255) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.select_1'))) STORED,
	`select_2` varchar(255) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.select_2'))) STORED,
	`select_3` varchar(255) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.select_3'))) STORED,
	`select_4` varchar(255) GENERATED ALWAYS AS (json_unquote(json_extract(`data`, '$.slots.select_4'))) STORED,
	CONSTRAINT `record_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `record` ADD CONSTRAINT `record_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `record` ADD CONSTRAINT `record_object_type_id_object_type_id_fk` FOREIGN KEY (`object_type_id`) REFERENCES `object_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `record` ADD CONSTRAINT `record_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `record` ADD CONSTRAINT `record_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `record_org_type_status_idx` ON `record` (`organization_id`,`object_type_id`,`status`);--> statement-breakpoint
CREATE INDEX `record_org_type_deleted_idx` ON `record` (`organization_id`,`object_type_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `record_text1_idx` ON `record` (`organization_id`,`object_type_id`,`text_1`);--> statement-breakpoint
CREATE INDEX `record_text2_idx` ON `record` (`organization_id`,`object_type_id`,`text_2`);--> statement-breakpoint
CREATE INDEX `record_text3_idx` ON `record` (`organization_id`,`object_type_id`,`text_3`);--> statement-breakpoint
CREATE INDEX `record_text4_idx` ON `record` (`organization_id`,`object_type_id`,`text_4`);--> statement-breakpoint
CREATE INDEX `record_text5_idx` ON `record` (`organization_id`,`object_type_id`,`text_5`);--> statement-breakpoint
CREATE INDEX `record_text6_idx` ON `record` (`organization_id`,`object_type_id`,`text_6`);--> statement-breakpoint
CREATE INDEX `record_text7_idx` ON `record` (`organization_id`,`object_type_id`,`text_7`);--> statement-breakpoint
CREATE INDEX `record_text8_idx` ON `record` (`organization_id`,`object_type_id`,`text_8`);--> statement-breakpoint
CREATE INDEX `record_number1_idx` ON `record` (`organization_id`,`object_type_id`,`number_1`);--> statement-breakpoint
CREATE INDEX `record_number2_idx` ON `record` (`organization_id`,`object_type_id`,`number_2`);--> statement-breakpoint
CREATE INDEX `record_number3_idx` ON `record` (`organization_id`,`object_type_id`,`number_3`);--> statement-breakpoint
CREATE INDEX `record_number4_idx` ON `record` (`organization_id`,`object_type_id`,`number_4`);--> statement-breakpoint
CREATE INDEX `record_date1_idx` ON `record` (`organization_id`,`object_type_id`,`date_1`);--> statement-breakpoint
CREATE INDEX `record_date2_idx` ON `record` (`organization_id`,`object_type_id`,`date_2`);--> statement-breakpoint
CREATE INDEX `record_date3_idx` ON `record` (`organization_id`,`object_type_id`,`date_3`);--> statement-breakpoint
CREATE INDEX `record_date4_idx` ON `record` (`organization_id`,`object_type_id`,`date_4`);--> statement-breakpoint
CREATE INDEX `record_bool1_idx` ON `record` (`organization_id`,`object_type_id`,`bool_1`);--> statement-breakpoint
CREATE INDEX `record_bool2_idx` ON `record` (`organization_id`,`object_type_id`,`bool_2`);--> statement-breakpoint
CREATE INDEX `record_select1_idx` ON `record` (`organization_id`,`object_type_id`,`select_1`);--> statement-breakpoint
CREATE INDEX `record_select2_idx` ON `record` (`organization_id`,`object_type_id`,`select_2`);--> statement-breakpoint
CREATE INDEX `record_select3_idx` ON `record` (`organization_id`,`object_type_id`,`select_3`);--> statement-breakpoint
CREATE INDEX `record_select4_idx` ON `record` (`organization_id`,`object_type_id`,`select_4`);