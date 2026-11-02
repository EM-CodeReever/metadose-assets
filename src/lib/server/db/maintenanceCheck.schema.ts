import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, text, timestamp, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { record } from './record.schema';
import { lookupValue } from './lookup.schema';

/**
 * A permanent log entry for one maintenance check — kept as its own table (same reasoning as
 * `checkout`/`attachment`: an operationally-significant event, not just a field edit) so a
 * record's maintenance history survives independently of whatever its current condition/schedule
 * happens to be.
 */
export const maintenanceCheck = mysqlTable(
	'maintenance_check',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		recordId: varchar('record_id', { length: 36 })
			.notNull()
			.references(() => record.id, { onDelete: 'cascade' }),
		performedBy: varchar('performed_by', { length: 36 }).references(() => user.id),
		performedAt: timestamp('performed_at', { fsp: 3 }).defaultNow().notNull(),
		// Only set when the object type has a condition field — the condition the record was set
		// to as a result of this check (unchanged if the admin didn't adjust it).
		conditionId: varchar('condition_id', { length: 36 }).references(() => lookupValue.id),
		// Mandatory every time, even when nothing was wrong — see the record page's placeholder
		// guidance for what a good note looks like.
		note: text('note').notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [index('maintenance_check_org_record_idx').on(t.organizationId, t.recordId)]
);

export const maintenanceCheckRelations = relations(maintenanceCheck, ({ one }) => ({
	performedByUser: one(user, { fields: [maintenanceCheck.performedBy], references: [user.id] }),
	condition: one(lookupValue, { fields: [maintenanceCheck.conditionId], references: [lookupValue.id] })
}));
