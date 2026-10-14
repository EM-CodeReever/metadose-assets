CREATE TABLE `instance_settings` (
	`id` varchar(36) NOT NULL,
	`smtp_host` varchar(255),
	`smtp_port` int,
	`smtp_secure` boolean NOT NULL DEFAULT false,
	`smtp_user` varchar(255),
	`smtp_pass` varchar(255),
	`smtp_from` varchar(255),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `instance_settings_id` PRIMARY KEY(`id`)
);
