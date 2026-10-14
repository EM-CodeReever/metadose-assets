import { mysqlTable, varchar, mysqlEnum, int, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/mysql-core';
import { organization } from './auth.schema';

export const LOOKUP_KINDS = ['manufacturer', 'category', 'condition'] as const;
export type LookupKind = (typeof LOOKUP_KINDS)[number];

/** One shared table for Manufacturers/Categories/Conditions — structurally identical, split by `kind`. */
export const lookupValue = mysqlTable(
	'lookup_value',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		kind: mysqlEnum('kind', LOOKUP_KINDS).notNull(),
		name: varchar('name', { length: 255 }).notNull(),
		sortOrder: int('sort_order').default(0).notNull(),
		// Only meaningful for kind='condition': when a quantity split (see checkouts.ts's
		// checkinWithConditionChange) lands units on a condition flagged here, the resulting
		// record is automatically taken out of circulation (requestableOverride set to false).
		outOfService: boolean('out_of_service').default(false).notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('lookup_value_org_kind_name_uq').on(t.organizationId, t.kind, t.name),
		index('lookup_value_org_kind_idx').on(t.organizationId, t.kind)
	]
);
