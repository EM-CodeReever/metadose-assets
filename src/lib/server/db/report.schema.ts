import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, json, timestamp, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { objectType } from './object.schema';
import type { FilterCondition } from '$lib/reportFilters';

export interface ReportConfig {
	/** Field keys to display, in order (detail mode only — ignored when groupBy is set). */
	columns: string[];
	/** AND-combined filter conditions — see `$lib/reportFilters` for the operator catalog. */
	filters: FilterCondition[];
	sortKey?: string;
	sortDirection?: 'asc' | 'desc';
	/** When set, the report aggregates a count of records per distinct value of this field. */
	groupBy?: string;
	/** When set alongside groupBy, also sums this numeric field per group. */
	aggregateField?: string;
}

export const reportDefinition = mysqlTable(
	'report_definition',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		objectTypeId: varchar('object_type_id', { length: 36 })
			.notNull()
			.references(() => objectType.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 255 }).notNull(),
		config: json('config').$type<ReportConfig>().notNull(),
		createdBy: varchar('created_by', { length: 36 }).references(() => user.id),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('report_org_type_idx').on(t.organizationId, t.objectTypeId)]
);

export const reportDefinitionRelations = relations(reportDefinition, ({ one }) => ({
	objectType: one(objectType, { fields: [reportDefinition.objectTypeId], references: [objectType.id] })
}));
