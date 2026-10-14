ALTER TABLE `object_type` ADD `tracking_mode` enum('individual','bulk') DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `object_type` ADD `quantity_field_key` varchar(100);