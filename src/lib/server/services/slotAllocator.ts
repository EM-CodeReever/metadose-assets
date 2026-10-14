import { and, eq, like, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { fieldDefinition } from '$lib/server/db/schema';
import { SLOT_CAPACITY, SLOT_PREFIX, type SlotFamily } from '$lib/server/db/record.schema';
import type { FieldDataType } from './fieldDefinitions';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export class SlotExhaustedError extends Error {
	constructor(
		public family: SlotFamily,
		public capacity: number
	) {
		super(
			`No free "${family}" slots available (limit ${capacity}). Turn off "filterable"/"reportable" on another ${family} field first.`
		);
	}
}

export function slotFamilyFor(dataType: FieldDataType): SlotFamily {
	switch (dataType) {
		case 'text':
		case 'user_reference':
		case 'reference':
			return 'text';
		case 'number':
			return 'number';
		case 'date':
			return 'date';
		case 'boolean':
			return 'boolean';
		case 'select':
			return 'select';
	}
}

export async function allocateSlot(tx: Tx, objectTypeId: string, dataType: FieldDataType): Promise<string> {
	const family = slotFamilyFor(dataType);
	const prefix = SLOT_PREFIX[family];

	const used = await tx.query.fieldDefinition.findMany({
		where: and(eq(fieldDefinition.objectTypeId, objectTypeId), like(fieldDefinition.storageSlot, `${prefix}\\_%`))
	});
	const usedSlots = new Set(used.map((f) => f.storageSlot));

	for (let i = 1; i <= SLOT_CAPACITY[family]; i++) {
		const candidate = `${prefix}_${i}`;
		if (!usedSlots.has(candidate)) return candidate;
	}
	throw new SlotExhaustedError(family, SLOT_CAPACITY[family]);
}

/** Rewrites data.slots.<slot> from data.values.<fieldKey> for every existing record of this object type. */
export async function backfillSlot(tx: Tx, objectTypeId: string, fieldKey: string, slot: string, family: SlotFamily) {
	const valuePath = `$.values.${fieldKey}`;
	const slotPath = `$.slots.${slot}`;

	// Booleans are mirrored as 0/1 (not JSON true/false) so the record table's
	// generated column can `CAST(... AS UNSIGNED)` unambiguously.
	const valueExpr =
		family === 'boolean'
			? sql`cast(json_extract(\`data\`, ${valuePath}) as unsigned)`
			: sql`json_extract(\`data\`, ${valuePath})`;

	await tx.execute(sql`
		UPDATE \`record\`
		SET \`data\` = JSON_SET(\`data\`, ${slotPath}, ${valueExpr})
		WHERE \`object_type_id\` = ${objectTypeId}
	`);
}
