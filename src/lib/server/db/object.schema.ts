import { relations } from 'drizzle-orm';
import {
	mysqlTable,
	varchar,
	text,
	boolean,
	int,
	json,
	mysqlEnum,
	timestamp,
	index,
	uniqueIndex
} from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { LOOKUP_KINDS } from './lookup.schema';

export const objectType = mysqlTable(
	'object_type',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 255 }).notNull(),
		slug: varchar('slug', { length: 100 }).notNull(),
		icon: varchar('icon', { length: 50 }),
		description: text('description'),
		// Drives real behavior (checkout rules, sidebar placement) for the four built-in kinds —
		// each org gets exactly one auto-provisioned singleton per non-custom kind (see
		// objectTypes.ensureBuiltinObjectTypes). 'custom' is the only user-creatable kind.
		builtinKind: mysqlEnum('builtin_kind', ['asset', 'accessory', 'consumable', 'component', 'custom'])
			.default('custom')
			.notNull(),
		isArchived: boolean('is_archived').default(false).notNull(),
		// Whether members can submit a checkout request for records of this type. Meaningless for
		// 'component' (checks out into an asset, never to a person) — enforced in checkoutRequests.ts
		// regardless of this flag's stored value.
		requestable: boolean('requestable').default(true).notNull(),
		// Up to 3 field keys (e.g. `assetTag`, `serialNumber`, a custom text field) printed as
		// separate lines under a record's barcode/QR label, and joined into the barcode's encoded
		// data — null/empty means labels fall back to the record's name.
		barcodeFieldKeys: json('barcode_field_keys').$type<string[]>(),
		// Only meaningful for builtinKind === 'custom' (the four builtins have this hardcoded —
		// see KIND_RULES in checkouts.ts): whether records of this type are individually tracked
		// (asset-like — one unique unit per record) or tracked in bulk by a quantity field
		// (accessory-like). Fixed at creation, same as builtinKind itself, since changing it after
		// records already exist would leave their data in an inconsistent shape.
		trackingMode: mysqlEnum('tracking_mode', ['individual', 'bulk']).default('individual').notNull(),
		// Only meaningful when trackingMode === 'bulk': which of this type's own field_definition
		// keys (a 'number' field) holds the total quantity — e.g. `seats` on a "Software Licenses"
		// type, instead of requiring a field literally named `quantity`. Null until the admin
		// configures it on the settings page (see the barcodeFieldKeys picker for the same pattern).
		quantityFieldKey: varchar('quantity_field_key', { length: 100 }),
		// Only meaningful for an individually-tracked type (builtinKind 'asset', or 'custom' with
		// trackingMode 'individual') — whether a 'component' record can be installed into records
		// of this type. Real assets have always allowed this; a custom individual type opts in
		// explicitly, since most (e.g. a generic "Vehicles" type) won't want component tracking.
		// Unlike trackingMode this stays editable after creation (see `requestable` for the same
		// editable-toggle pattern).
		allowComponentInstall: boolean('allow_component_install').default(false).notNull(),
		createdBy: varchar('created_by', { length: 36 }).references(() => user.id),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [
		uniqueIndex('object_type_org_slug_uq').on(t.organizationId, t.slug),
		index('object_type_org_idx').on(t.organizationId)
	]
);

export const fieldDefinition = mysqlTable(
	'field_definition',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		// Denormalized for direct scoping/indexing alongside objectTypeId.
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		objectTypeId: varchar('object_type_id', { length: 36 })
			.notNull()
			.references(() => objectType.id, { onDelete: 'cascade' }),
		key: varchar('key', { length: 100 }).notNull(),
		label: varchar('label', { length: 255 }).notNull(),
		dataType: mysqlEnum('data_type', [
			'text',
			'number',
			'date',
			'boolean',
			'select',
			'user_reference',
			'reference'
		]).notNull(),
		required: boolean('required').default(false).notNull(),
		defaultValue: json('default_value'),
		// Only meaningful when dataType === 'select'.
		selectOptions: json('select_options').$type<{ value: string; label: string }[]>(),
		// Only meaningful when dataType === 'reference' — which lookup_value list this points at.
		referenceKind: mysqlEnum('reference_kind', LOOKUP_KINDS),
		// Toggling these allocates/frees a generated+indexed "slot" column on the future
		// `record` table (introduced in the next phase) for fast filter/sort/report queries.
		filterable: boolean('filterable').default(false).notNull(),
		reportable: boolean('reportable').default(false).notNull(),
		storageSlot: varchar('storage_slot', { length: 20 }),
		sortOrder: int('sort_order').default(0).notNull(),
		// Wizard-seeded field — still a plain row, no hardcoded backend behavior keyed off this.
		isBuiltin: boolean('is_builtin').default(false).notNull(),
		// Can't be deleted (e.g. `name` on every kind, `quantity`/`minQuantity`/`remainingQuantity`
		// on quantity-based kinds) because service-layer logic depends on the key existing.
		locked: boolean('locked').default(false).notNull(),
		// Value is written by backend logic (checkouts.ts), never submitted from a create/edit form —
		// used only for `remainingQuantity` today.
		systemManaged: boolean('system_managed').default(false).notNull(),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { fsp: 3 })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [
		uniqueIndex('field_definition_type_key_uq').on(t.objectTypeId, t.key),
		index('field_definition_org_type_idx').on(t.organizationId, t.objectTypeId)
	]
);

export const objectTypeRelations = relations(objectType, ({ many }) => ({
	fields: many(fieldDefinition)
}));

export const fieldDefinitionRelations = relations(fieldDefinition, ({ one }) => ({
	objectType: one(objectType, {
		fields: [fieldDefinition.objectTypeId],
		references: [objectType.id]
	})
}));
