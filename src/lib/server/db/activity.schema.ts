import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, text, json, timestamp, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { record } from './record.schema';
import { objectType } from './object.schema';

export const activityLog = mysqlTable(
	'activity_log',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		recordId: varchar('record_id', { length: 36 }).references(() => record.id, { onDelete: 'cascade' }),
		objectTypeId: varchar('object_type_id', { length: 36 }).references(() => objectType.id, { onDelete: 'cascade' }),
		actorUserId: varchar('actor_user_id', { length: 36 }).references(() => user.id),
		// Free-form string ('record.created', 'record.checked_out', 'field_definition.updated', ...),
		// not a DB enum, so new event types never need a migration.
		action: varchar('action', { length: 50 }).notNull(),
		summary: text('summary'),
		changes: json('changes').$type<{ before?: unknown; after?: unknown }>(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [
		index('activity_org_record_created_idx').on(t.organizationId, t.recordId, t.createdAt),
		index('activity_org_created_idx').on(t.organizationId, t.createdAt)
	]
);

export const activityLogRelations = relations(activityLog, ({ one }) => ({
	actor: one(user, { fields: [activityLog.actorUserId], references: [user.id] }),
	record: one(record, { fields: [activityLog.recordId], references: [record.id] }),
	objectType: one(objectType, { fields: [activityLog.objectTypeId], references: [objectType.id] })
}));
