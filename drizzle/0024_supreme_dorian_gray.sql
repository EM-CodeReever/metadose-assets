CREATE TABLE `email_template` (
	`key` varchar(50) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`html` text NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `email_template_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `ldap_group_dns` text;