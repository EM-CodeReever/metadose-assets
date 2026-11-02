import { mysqlTable, varchar, text, timestamp } from 'drizzle-orm/mysql-core';

/**
 * Admin-editable overrides for the app's outgoing emails. A missing row for a given `key` just
 * means "use the built-in default" (see `$lib/server/services/emailTemplates.ts`'s `TEMPLATE_DEFS`)
 * — nothing seeds this table, so every template behaves exactly as it always has until an admin
 * actually edits one.
 */
export const emailTemplate = mysqlTable('email_template', {
	key: varchar('key', { length: 50 }).primaryKey(),
	subject: varchar('subject', { length: 255 }).notNull(),
	html: text('html').notNull(),
	updatedAt: timestamp('updated_at', { fsp: 3 })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});
