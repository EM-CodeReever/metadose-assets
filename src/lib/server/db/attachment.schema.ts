import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, int, mysqlEnum, timestamp, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { record } from './record.schema';
import { checkout } from './checkout.schema';

export const attachment = mysqlTable(
	'attachment',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		recordId: varchar('record_id', { length: 36 })
			.notNull()
			.references(() => record.id, { onDelete: 'cascade' }),
		fileName: varchar('file_name', { length: 255 }).notNull(),
		mimeType: varchar('mime_type', { length: 150 }).notNull(),
		sizeBytes: int('size_bytes', { unsigned: true }).notNull(),
		// Only 'local' is implemented in v1 — the column exists so a future S3-compatible
		// backend can coexist with previously-uploaded local files during a migration.
		storageBackend: mysqlEnum('storage_backend', ['local', 's3']).default('local').notNull(),
		storageKey: varchar('storage_key', { length: 500 }).notNull(),
		uploadedBy: varchar('uploaded_by', { length: 36 }).references(() => user.id),
		// Set only for a server-generated EULA acceptance PDF — ties it to the exact checkout that
		// produced it, so a record that's been checked out to different people over time keeps one
		// permanent, separate acceptance record per checkout rather than one that gets overwritten.
		sourceCheckoutId: varchar('source_checkout_id', { length: 36 }).references(() => checkout.id, {
			onDelete: 'cascade'
		}),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [
		index('attachment_org_record_idx').on(t.organizationId, t.recordId),
		index('attachment_org_checkout_idx').on(t.organizationId, t.sourceCheckoutId)
	]
);

export const attachmentRelations = relations(attachment, ({ one }) => ({
	uploadedByUser: one(user, { fields: [attachment.uploadedBy], references: [user.id] }),
	sourceCheckout: one(checkout, { fields: [attachment.sourceCheckoutId], references: [checkout.id] })
}));
