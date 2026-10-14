import { relations, sql } from 'drizzle-orm';
import { mysqlTable, varchar, json, timestamp, decimal, boolean, datetime, int, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { objectType } from './object.schema';
import { location } from './location.schema';

/**
 * Fixed pool of reusable "slot" columns, one MySQL generated column per slot.
 * A field becomes fast-filterable/sortable by having its value mirrored into
 * one of these slots (see field_definition.storageSlot) instead of the app
 * running ALTER TABLE at runtime — see the record storage design notes.
 */
export const SLOT_CAPACITY = { text: 8, number: 4, date: 4, boolean: 2, select: 4 } as const;
export type SlotFamily = keyof typeof SLOT_CAPACITY;
export const SLOT_PREFIX: Record<SlotFamily, string> = {
	text: 'text',
	number: 'number',
	date: 'date',
	boolean: 'bool',
	select: 'select'
};

export interface RecordData {
	/** Canonical field values, keyed by field_definition.key. */
	values: Record<string, unknown>;
	/** Mirror of values for fields with a storageSlot, keyed by slot name (e.g. "text_1"). */
	slots: Record<string, unknown>;
}

export const record = mysqlTable(
	'record',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		objectTypeId: varchar('object_type_id', { length: 36 })
			.notNull()
			.references(() => objectType.id, { onDelete: 'cascade' }),
		data: json('data').$type<RecordData>().notNull(),
		status: varchar('status', { length: 50 }).default('available').notNull(),
		createdBy: varchar('created_by', { length: 36 }).references(() => user.id),
		updatedBy: varchar('updated_by', { length: 36 }).references(() => user.id),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		deletedAt: timestamp('deleted_at', { fsp: 3 }),

		// Optional cover image, independent of the general attachments list — a record has at
		// most one, shown as a small square thumbnail on its detail page.
		imageStorageKey: varchar('image_storage_key', { length: 500 }),
		imageMimeType: varchar('image_mime_type', { length: 150 }),
		imageFileName: varchar('image_file_name', { length: 255 }),
		imageSizeBytes: int('image_size_bytes', { unsigned: true }),

		// Where an asset "lives" when it isn't checked out to anyone — distinct from a checkout's
		// own location, which only exists while there's an active checkout. Lets a brand-new or
		// just-checked-in asset still show a sensible location instead of nothing at all.
		defaultLocationId: varchar('default_location_id', { length: 36 }).references(() => location.id, {
			onDelete: 'set null'
		}),

		// Per-record exception to the object type's own `requestable` default: null inherits it,
		// true/false forces requestable on/off for this one record regardless of the type setting.
		requestableOverride: boolean('requestable_override'),

		text1: varchar('text_1', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_1'))`,
			{ mode: 'stored' }
		),
		text2: varchar('text_2', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_2'))`,
			{ mode: 'stored' }
		),
		text3: varchar('text_3', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_3'))`,
			{ mode: 'stored' }
		),
		text4: varchar('text_4', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_4'))`,
			{ mode: 'stored' }
		),
		text5: varchar('text_5', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_5'))`,
			{ mode: 'stored' }
		),
		text6: varchar('text_6', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_6'))`,
			{ mode: 'stored' }
		),
		text7: varchar('text_7', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_7'))`,
			{ mode: 'stored' }
		),
		text8: varchar('text_8', { length: 500 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.text_8'))`,
			{ mode: 'stored' }
		),

		number1: decimal('number_1', { precision: 20, scale: 4 }).generatedAlwaysAs(
			sql`cast(json_extract(\`data\`, '$.slots.number_1') as decimal(20,4))`,
			{ mode: 'stored' }
		),
		number2: decimal('number_2', { precision: 20, scale: 4 }).generatedAlwaysAs(
			sql`cast(json_extract(\`data\`, '$.slots.number_2') as decimal(20,4))`,
			{ mode: 'stored' }
		),
		number3: decimal('number_3', { precision: 20, scale: 4 }).generatedAlwaysAs(
			sql`cast(json_extract(\`data\`, '$.slots.number_3') as decimal(20,4))`,
			{ mode: 'stored' }
		),
		number4: decimal('number_4', { precision: 20, scale: 4 }).generatedAlwaysAs(
			sql`cast(json_extract(\`data\`, '$.slots.number_4') as decimal(20,4))`,
			{ mode: 'stored' }
		),

		date1: datetime('date_1').generatedAlwaysAs(
			sql`cast(json_unquote(json_extract(\`data\`, '$.slots.date_1')) as datetime)`,
			{ mode: 'stored' }
		),
		date2: datetime('date_2').generatedAlwaysAs(
			sql`cast(json_unquote(json_extract(\`data\`, '$.slots.date_2')) as datetime)`,
			{ mode: 'stored' }
		),
		date3: datetime('date_3').generatedAlwaysAs(
			sql`cast(json_unquote(json_extract(\`data\`, '$.slots.date_3')) as datetime)`,
			{ mode: 'stored' }
		),
		date4: datetime('date_4').generatedAlwaysAs(
			sql`cast(json_unquote(json_extract(\`data\`, '$.slots.date_4')) as datetime)`,
			{ mode: 'stored' }
		),

		// Slot mirror stores 0/1 (not JSON true/false) so this cast is unambiguous — see buildSlotsJson.
		bool1: boolean('bool_1').generatedAlwaysAs(
			sql`cast(json_extract(\`data\`, '$.slots.bool_1') as unsigned)`,
			{ mode: 'stored' }
		),
		bool2: boolean('bool_2').generatedAlwaysAs(
			sql`cast(json_extract(\`data\`, '$.slots.bool_2') as unsigned)`,
			{ mode: 'stored' }
		),

		select1: varchar('select_1', { length: 255 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.select_1'))`,
			{ mode: 'stored' }
		),
		select2: varchar('select_2', { length: 255 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.select_2'))`,
			{ mode: 'stored' }
		),
		select3: varchar('select_3', { length: 255 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.select_3'))`,
			{ mode: 'stored' }
		),
		select4: varchar('select_4', { length: 255 }).generatedAlwaysAs(
			sql`json_unquote(json_extract(\`data\`, '$.slots.select_4'))`,
			{ mode: 'stored' }
		)
	},
	(t) => [
		index('record_org_type_status_idx').on(t.organizationId, t.objectTypeId, t.status),
		index('record_org_type_deleted_idx').on(t.organizationId, t.objectTypeId, t.deletedAt),
		index('record_text1_idx').on(t.organizationId, t.objectTypeId, t.text1),
		index('record_text2_idx').on(t.organizationId, t.objectTypeId, t.text2),
		index('record_text3_idx').on(t.organizationId, t.objectTypeId, t.text3),
		index('record_text4_idx').on(t.organizationId, t.objectTypeId, t.text4),
		index('record_text5_idx').on(t.organizationId, t.objectTypeId, t.text5),
		index('record_text6_idx').on(t.organizationId, t.objectTypeId, t.text6),
		index('record_text7_idx').on(t.organizationId, t.objectTypeId, t.text7),
		index('record_text8_idx').on(t.organizationId, t.objectTypeId, t.text8),
		index('record_number1_idx').on(t.organizationId, t.objectTypeId, t.number1),
		index('record_number2_idx').on(t.organizationId, t.objectTypeId, t.number2),
		index('record_number3_idx').on(t.organizationId, t.objectTypeId, t.number3),
		index('record_number4_idx').on(t.organizationId, t.objectTypeId, t.number4),
		index('record_date1_idx').on(t.organizationId, t.objectTypeId, t.date1),
		index('record_date2_idx').on(t.organizationId, t.objectTypeId, t.date2),
		index('record_date3_idx').on(t.organizationId, t.objectTypeId, t.date3),
		index('record_date4_idx').on(t.organizationId, t.objectTypeId, t.date4),
		index('record_bool1_idx').on(t.organizationId, t.objectTypeId, t.bool1),
		index('record_bool2_idx').on(t.organizationId, t.objectTypeId, t.bool2),
		index('record_select1_idx').on(t.organizationId, t.objectTypeId, t.select1),
		index('record_select2_idx').on(t.organizationId, t.objectTypeId, t.select2),
		index('record_select3_idx').on(t.organizationId, t.objectTypeId, t.select3),
		index('record_select4_idx').on(t.organizationId, t.objectTypeId, t.select4)
	]
);

export const recordRelations = relations(record, ({ one }) => ({
	objectType: one(objectType, { fields: [record.objectTypeId], references: [objectType.id] })
}));

/** Maps a slot name (as stored in field_definition.storageSlot, e.g. "text_3") to its column. */
export const SLOT_COLUMNS = {
	text_1: record.text1,
	text_2: record.text2,
	text_3: record.text3,
	text_4: record.text4,
	text_5: record.text5,
	text_6: record.text6,
	text_7: record.text7,
	text_8: record.text8,
	number_1: record.number1,
	number_2: record.number2,
	number_3: record.number3,
	number_4: record.number4,
	date_1: record.date1,
	date_2: record.date2,
	date_3: record.date3,
	date_4: record.date4,
	bool_1: record.bool1,
	bool_2: record.bool2,
	select_1: record.select1,
	select_2: record.select2,
	select_3: record.select3,
	select_4: record.select4
} as const;
