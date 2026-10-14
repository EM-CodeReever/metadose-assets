CREATE TABLE `checkout_request` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`record_id` varchar(36) NOT NULL,
	`requested_by_user_id` varchar(36) NOT NULL,
	`status` enum('pending','fulfilled','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`note` text,
	`decision_note` text,
	`decided_by` varchar(36),
	`decided_at` timestamp(3),
	`fulfilled_checkout_id` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `checkout_request_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `checkout` ADD `accepted_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_url` varchar(500);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_bind_dn` varchar(500);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_bind_password` varchar(255);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_search_base` varchar(500);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_user_filter` varchar(500) DEFAULT '(objectClass=person)';--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_email_attribute` varchar(100) DEFAULT 'mail';--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_name_attribute` varchar(100) DEFAULT 'cn';--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_default_organization_id` varchar(36);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_default_role` varchar(50);--> statement-breakpoint
ALTER TABLE `checkout_request` ADD CONSTRAINT `checkout_request_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_request` ADD CONSTRAINT `checkout_request_record_id_record_id_fk` FOREIGN KEY (`record_id`) REFERENCES `record`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_request` ADD CONSTRAINT `checkout_request_requested_by_user_id_user_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_request` ADD CONSTRAINT `checkout_request_decided_by_user_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_request` ADD CONSTRAINT `checkout_request_fulfilled_checkout_id_checkout_id_fk` FOREIGN KEY (`fulfilled_checkout_id`) REFERENCES `checkout`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `checkout_request_org_status_idx` ON `checkout_request` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `checkout_request_requester_idx` ON `checkout_request` (`organization_id`,`requested_by_user_id`);--> statement-breakpoint
ALTER TABLE `instance_settings` ADD CONSTRAINT `instance_settings_ldap_default_org_id_fk` FOREIGN KEY (`ldap_default_organization_id`) REFERENCES `organization`(`id`) ON DELETE set null ON UPDATE no action;