import { mysqlTable, varchar, text, timestamp, index } from 'drizzle-orm/mysql-core';
import { organization } from './auth.schema';

export const location = mysqlTable(
	'location',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 255 }).notNull(),
		address: text('address'),
		// No DB-level FK to avoid a self-referencing constraint — checked at the app layer if ever used.
		parentLocationId: varchar('parent_location_id', { length: 36 }),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('location_org_idx').on(t.organizationId)]
);
