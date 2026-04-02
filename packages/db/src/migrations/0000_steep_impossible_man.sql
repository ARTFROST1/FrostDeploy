CREATE TABLE `deploy_locks` (
	`project_id` text NOT NULL,
	`deployment_id` text,
	`locked_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deployment_id`) REFERENCES `deployments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deploy_locks_project_id_unique` ON `deploy_locks` (`project_id`);--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`commit_sha` text NOT NULL,
	`commit_msg` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`logs` text,
	`duration_ms` integer,
	`error` text,
	`triggered_by` text DEFAULT 'manual' NOT NULL,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_deployments_project_created` ON `deployments` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_deployments_project_status` ON `deployments` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_deployments_status` ON `deployments` (`status`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`ssl_status` text DEFAULT 'pending' NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_domain_unique` ON `domains` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_domains_project` ON `domains` (`project_id`);--> statement-breakpoint
CREATE TABLE `env_variables` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`key` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`is_secret` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_env_variables_project` ON `env_variables` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_env_variables_project_key` ON `env_variables` (`project_id`,`key`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo_url` text NOT NULL,
	`branch` text DEFAULT 'main' NOT NULL,
	`domain` text,
	`port` integer NOT NULL,
	`framework` text,
	`build_cmd` text,
	`start_cmd` text,
	`output_dir` text DEFAULT 'dist',
	`src_dir` text NOT NULL,
	`runtime_dir` text NOT NULL,
	`service_name` text NOT NULL,
	`current_sha` text,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_port_unique` ON `projects` (`port`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_service_name_unique` ON `projects` (`service_name`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`is_encrypted` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
