ALTER TABLE `object_type` ADD `eula_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `object_type` ADD `eula_text` text;--> statement-breakpoint
ALTER TABLE `checkout` ADD `requires_eula_acceptance` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout` ADD `eula_accepted_name` varchar(255);