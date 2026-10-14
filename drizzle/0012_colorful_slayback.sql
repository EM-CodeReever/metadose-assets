ALTER TABLE `record` ADD `image_storage_key` varchar(500);--> statement-breakpoint
ALTER TABLE `record` ADD `image_mime_type` varchar(150);--> statement-breakpoint
ALTER TABLE `record` ADD `image_file_name` varchar(255);--> statement-breakpoint
ALTER TABLE `record` ADD `image_size_bytes` int unsigned;