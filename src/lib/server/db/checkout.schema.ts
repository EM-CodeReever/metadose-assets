import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, text, int, timestamp, mysqlEnum, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { record } from './record.schema';
import { location } from './location.schema';

export const checkout = mysqlTable(
	'checkout',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		recordId: varchar('record_id', { length: 36 })
			.notNull()
			.references(() => record.id, { onDelete: 'cascade' }),
		// Units involved — always 1 for assets; can be >1 for accessory/consumable/component.
		quantity: int('quantity').default(1).notNull(),
		// 'asset' is for components, checked out to another asset record rather than a user/location.
		assignedToType: mysqlEnum('assigned_to_type', ['user', 'location', 'asset']).notNull(),
		assignedToUserId: varchar('assigned_to_user_id', { length: 36 }).references(() => user.id),
		assignedToLocationId: varchar('assigned_to_location_id', { length: 36 }).references(() => location.id),
		assignedToRecordId: varchar('assigned_to_record_id', { length: 36 }).references(() => record.id),
		checkedOutBy: varchar('checked_out_by', { length: 36 })
			.notNull()
			.references(() => user.id),
		checkedOutAt: timestamp('checked_out_at', { fsp: 3 }).defaultNow().notNull(),
		dueAt: timestamp('due_at', { fsp: 3 }),
		checkedInAt: timestamp('checked_in_at', { fsp: 3 }),
		checkedInBy: varchar('checked_in_by', { length: 36 }).references(() => user.id),
		// The assignee's own one-click "I received this" acknowledgment — distinct from
		// checkedInAt, which is when it comes back, not when it was first handed over.
		acceptedAt: timestamp('accepted_at', { fsp: 3 }),
		notes: text('notes'),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [
		// "Currently open" lookups always filter on checkedInAt IS NULL alongside these.
		index('checkout_org_record_open_idx').on(t.organizationId, t.recordId, t.checkedInAt),
		index('checkout_org_user_idx').on(t.organizationId, t.assignedToUserId),
		index('checkout_org_location_idx').on(t.organizationId, t.assignedToLocationId)
	]
);

// Validated in checkouts.ts (not as a DB constraint, to keep this portable across MySQL versions):
// assignedToType 'location'/'asset' sets exactly that one column; assignedToType 'user' sets BOTH
// assignedToUserId (who it's assigned to) and, for assets, assignedToLocationId (where it
// physically is) — a location doubles as both assignment and tracking, but a user needs a
// separate location to track the asset's whereabouts.

export const checkoutRelations = relations(checkout, ({ one }) => ({
	record: one(record, { fields: [checkout.recordId], references: [record.id] }),
	assignedToUser: one(user, { fields: [checkout.assignedToUserId], references: [user.id] }),
	assignedToLocation: one(location, { fields: [checkout.assignedToLocationId], references: [location.id] }),
	assignedToRecord: one(record, { fields: [checkout.assignedToRecordId], references: [record.id] }),
	checkedOutByUser: one(user, { fields: [checkout.checkedOutBy], references: [user.id] }),
	checkedInByUser: one(user, { fields: [checkout.checkedInBy], references: [user.id] })
}));
