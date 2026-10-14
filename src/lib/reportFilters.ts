/**
 * Shared filter-operator metadata for the report builder — pure data/logic, no server imports,
 * so both the Svelte UI (choosing which operators to offer per field) and the server-side query
 * engine (reports.ts, interpreting a saved filter) read from the same definitions.
 */

export type FilterOperator =
	| 'equals'
	| 'not_equals'
	| 'contains'
	| 'not_contains'
	| 'starts_with'
	| 'ends_with'
	| 'wildcard'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'between'
	| 'on'
	| 'before'
	| 'on_or_before'
	| 'after'
	| 'on_or_after'
	| 'relative_last_days'
	| 'in'
	| 'is_empty'
	| 'is_not_empty';

/** The kind of value widget(s) an operator needs. */
export type OperatorValueKind = 'none' | 'single' | 'double' | 'multi';

/** The filter-UI family a field belongs to — distinct from the storage `dataType` for `status`, a built-in pseudo-field. */
export type FilterFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'user_reference' | 'reference' | 'status';

export interface OperatorDef {
	value: FilterOperator;
	label: string;
	valueKind: OperatorValueKind;
}

export const OPERATORS_BY_FIELD_TYPE: Record<FilterFieldType, OperatorDef[]> = {
	text: [
		{ value: 'contains', label: 'Contains', valueKind: 'single' },
		{ value: 'not_contains', label: 'Does not contain', valueKind: 'single' },
		{ value: 'equals', label: 'Is exactly', valueKind: 'single' },
		{ value: 'not_equals', label: 'Is not', valueKind: 'single' },
		{ value: 'starts_with', label: 'Starts with', valueKind: 'single' },
		{ value: 'ends_with', label: 'Ends with', valueKind: 'single' },
		{ value: 'wildcard', label: 'Matches pattern (* and ?)', valueKind: 'single' },
		{ value: 'is_empty', label: 'Is empty', valueKind: 'none' },
		{ value: 'is_not_empty', label: 'Is not empty', valueKind: 'none' }
	],
	number: [
		{ value: 'equals', label: 'Equals', valueKind: 'single' },
		{ value: 'not_equals', label: 'Does not equal', valueKind: 'single' },
		{ value: 'gt', label: 'Greater than', valueKind: 'single' },
		{ value: 'gte', label: 'Greater than or equal to', valueKind: 'single' },
		{ value: 'lt', label: 'Less than', valueKind: 'single' },
		{ value: 'lte', label: 'Less than or equal to', valueKind: 'single' },
		{ value: 'between', label: 'Between', valueKind: 'double' },
		{ value: 'is_empty', label: 'Is empty', valueKind: 'none' },
		{ value: 'is_not_empty', label: 'Is not empty', valueKind: 'none' }
	],
	date: [
		{ value: 'on', label: 'On', valueKind: 'single' },
		{ value: 'before', label: 'Before', valueKind: 'single' },
		{ value: 'on_or_before', label: 'On or before', valueKind: 'single' },
		{ value: 'after', label: 'After', valueKind: 'single' },
		{ value: 'on_or_after', label: 'On or after', valueKind: 'single' },
		{ value: 'between', label: 'Between', valueKind: 'double' },
		{ value: 'relative_last_days', label: 'In the last N days', valueKind: 'single' },
		{ value: 'is_empty', label: 'Is empty', valueKind: 'none' },
		{ value: 'is_not_empty', label: 'Is not empty', valueKind: 'none' }
	],
	boolean: [{ value: 'equals', label: 'Is', valueKind: 'single' }],
	select: [
		{ value: 'equals', label: 'Is', valueKind: 'single' },
		{ value: 'not_equals', label: 'Is not', valueKind: 'single' },
		{ value: 'in', label: 'Is any of', valueKind: 'multi' },
		{ value: 'is_empty', label: 'Is empty', valueKind: 'none' },
		{ value: 'is_not_empty', label: 'Is not empty', valueKind: 'none' }
	],
	user_reference: [
		{ value: 'equals', label: 'Is', valueKind: 'single' },
		{ value: 'in', label: 'Is any of', valueKind: 'multi' },
		{ value: 'is_empty', label: 'Is empty', valueKind: 'none' },
		{ value: 'is_not_empty', label: 'Is not empty', valueKind: 'none' }
	],
	reference: [
		{ value: 'equals', label: 'Is', valueKind: 'single' },
		{ value: 'in', label: 'Is any of', valueKind: 'multi' },
		{ value: 'is_empty', label: 'Is empty', valueKind: 'none' },
		{ value: 'is_not_empty', label: 'Is not empty', valueKind: 'none' }
	],
	status: [
		{ value: 'equals', label: 'Is', valueKind: 'single' },
		{ value: 'in', label: 'Is any of', valueKind: 'multi' }
	]
};

export function operatorsFor(fieldType: FilterFieldType): OperatorDef[] {
	return OPERATORS_BY_FIELD_TYPE[fieldType];
}

export function valueKindFor(fieldType: FilterFieldType, operator: string): OperatorValueKind {
	return OPERATORS_BY_FIELD_TYPE[fieldType].find((o) => o.value === operator)?.valueKind ?? 'single';
}

/** Built-in pseudo-fields available in every report alongside the object type's own fields. */
export const STATUS_FIELD_KEY = '__status';
export const CREATED_AT_FIELD_KEY = '__createdAt';

export const STATUS_OPTIONS = [
	{ value: 'available', label: 'Available' },
	{ value: 'checked_out', label: 'Checked out' },
	{ value: 'archived', label: 'Archived' }
];

export interface FilterCondition {
	id: string;
	fieldKey: string;
	operator: FilterOperator;
	value?: string;
	value2?: string;
	values?: string[];
}

/** Maps a field's storage `dataType` (plus the two pseudo-fields) to its filter-UI family. */
export function filterFieldType(dataType: string): FilterFieldType {
	switch (dataType) {
		case 'number':
			return 'number';
		case 'date':
			return 'date';
		case 'boolean':
			return 'boolean';
		case 'select':
			return 'select';
		case 'user_reference':
			return 'user_reference';
		case 'reference':
			return 'reference';
		default:
			return 'text';
	}
}

/** A human-readable summary of one filter condition, for the "criteria" line shown above a report. */
export function describeFilter(
	condition: FilterCondition,
	fieldLabel: string,
	resolveValue: (v: string) => string = (v) => v
): string {
	const op = condition.operator;
	const v = condition.value !== undefined ? resolveValue(condition.value) : '';
	const v2 = condition.value2 !== undefined ? resolveValue(condition.value2) : '';
	const vs = condition.values?.map(resolveValue).join(', ') ?? '';

	switch (op) {
		case 'equals':
			return `${fieldLabel} is ${v}`;
		case 'not_equals':
			return `${fieldLabel} is not ${v}`;
		case 'contains':
			return `${fieldLabel} contains "${v}"`;
		case 'not_contains':
			return `${fieldLabel} does not contain "${v}"`;
		case 'starts_with':
			return `${fieldLabel} starts with "${v}"`;
		case 'ends_with':
			return `${fieldLabel} ends with "${v}"`;
		case 'wildcard':
			return `${fieldLabel} matches "${v}"`;
		case 'gt':
			return `${fieldLabel} > ${v}`;
		case 'gte':
			return `${fieldLabel} ≥ ${v}`;
		case 'lt':
			return `${fieldLabel} < ${v}`;
		case 'lte':
			return `${fieldLabel} ≤ ${v}`;
		case 'between':
			return `${fieldLabel} is between ${v} and ${v2}`;
		case 'on':
			return `${fieldLabel} is on ${v}`;
		case 'before':
			return `${fieldLabel} is before ${v}`;
		case 'on_or_before':
			return `${fieldLabel} is on or before ${v}`;
		case 'after':
			return `${fieldLabel} is after ${v}`;
		case 'on_or_after':
			return `${fieldLabel} is on or after ${v}`;
		case 'relative_last_days':
			return `${fieldLabel} is in the last ${v} day${v === '1' ? '' : 's'}`;
		case 'in':
			return `${fieldLabel} is any of: ${vs}`;
		case 'is_empty':
			return `${fieldLabel} is empty`;
		case 'is_not_empty':
			return `${fieldLabel} is not empty`;
		default:
			return fieldLabel;
	}
}
