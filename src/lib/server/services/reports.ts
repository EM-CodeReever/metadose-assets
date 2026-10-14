import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { reportDefinition, record, fieldDefinition, SLOT_COLUMNS, type ReportConfig } from '$lib/server/db/schema';
import {
	STATUS_FIELD_KEY,
	CREATED_AT_FIELD_KEY,
	filterFieldType,
	type FilterCondition
} from '$lib/reportFilters';
import { logActivity } from './activityLog';

export type { ReportConfig };

export async function listReportDefinitions(organizationId: string) {
	return db.query.reportDefinition.findMany({
		where: eq(reportDefinition.organizationId, organizationId),
		with: { objectType: true },
		orderBy: (r, { desc }) => desc(r.updatedAt)
	});
}

export async function getReportDefinition(organizationId: string, reportId: string) {
	const found = await db.query.reportDefinition.findFirst({
		where: and(eq(reportDefinition.organizationId, organizationId), eq(reportDefinition.id, reportId)),
		with: { objectType: { with: { fields: true } } }
	});
	if (!found) return undefined;
	// Defensive default for reports saved before `filters` existed (or any malformed config).
	return { ...found, config: { ...found.config, filters: found.config.filters ?? [] } };
}

export async function createReportDefinition(params: {
	organizationId: string;
	objectTypeId: string;
	name: string;
	createdBy: string;
}): Promise<string> {
	const id = randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(reportDefinition).values({
			id,
			organizationId: params.organizationId,
			objectTypeId: params.objectTypeId,
			name: params.name,
			config: { columns: [], filters: [] },
			createdBy: params.createdBy
		});
		await logActivity(tx, {
			organizationId: params.organizationId,
			objectTypeId: params.objectTypeId,
			actorUserId: params.createdBy,
			action: 'report.created',
			summary: `Created report "${params.name}"`
		});
	});
	return id;
}

export async function updateReportConfig(organizationId: string, reportId: string, config: ReportConfig) {
	await db
		.update(reportDefinition)
		.set({ config })
		.where(and(eq(reportDefinition.organizationId, organizationId), eq(reportDefinition.id, reportId)));
}

export async function renameReportDefinition(organizationId: string, reportId: string, name: string) {
	await db
		.update(reportDefinition)
		.set({ name })
		.where(and(eq(reportDefinition.organizationId, organizationId), eq(reportDefinition.id, reportId)));
}

export async function deleteReportDefinition(organizationId: string, reportId: string, actorUserId: string) {
	const existing = await db.query.reportDefinition.findFirst({
		where: and(eq(reportDefinition.organizationId, organizationId), eq(reportDefinition.id, reportId))
	});
	await db.transaction(async (tx) => {
		await tx
			.delete(reportDefinition)
			.where(and(eq(reportDefinition.organizationId, organizationId), eq(reportDefinition.id, reportId)));
		if (existing) {
			await logActivity(tx, {
				organizationId,
				objectTypeId: existing.objectTypeId,
				actorUserId,
				action: 'report.deleted',
				summary: `Deleted report "${existing.name}"`
			});
		}
	});
}

type FieldRow = typeof fieldDefinition.$inferSelect;
type RecordRow = typeof record.$inferSelect;

export interface DetailResult {
	mode: 'detail';
	rows: RecordRow[];
	total: number;
}

export interface GroupedResult {
	mode: 'grouped';
	groupBy: string;
	aggregateField?: string;
	rows: { group: string; count: number; sum?: number }[];
}

const DETAIL_ROW_LIMIT = 1000;

function columnExprFor(field: FieldRow): SQL {
	if (field.storageSlot) {
		return sql`${SLOT_COLUMNS[field.storageSlot as keyof typeof SLOT_COLUMNS]}`;
	}
	return sql`json_unquote(json_extract(${record.data}, ${'$.values.' + field.key}))`;
}

function numericExprFor(field: FieldRow): SQL {
	if (field.storageSlot) return sql`${SLOT_COLUMNS[field.storageSlot as keyof typeof SLOT_COLUMNS]}`;
	return sql`CAST(${columnExprFor(field)} AS DECIMAL(20,4))`;
}

/** A DATE-typed expression for comparison — day-level granularity matches a plain `<input type=date>`. */
function dateExprFor(field: FieldRow): SQL {
	const base = field.storageSlot
		? sql`${SLOT_COLUMNS[field.storageSlot as keyof typeof SLOT_COLUMNS]}`
		: sql`REPLACE(${columnExprFor(field)}, 'Z', '')`;
	return sql`DATE(${base})`;
}

/** Escapes existing LIKE metacharacters so a literal substring search doesn't misfire on `%`/`_` in the value. */
function escapeLikeLiteral(value: string): string {
	return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Translates a user-typed glob pattern (`*`, `?`) into a LIKE pattern, after escaping real metacharacters. */
function toWildcardPattern(value: string): string {
	return escapeLikeLiteral(value).replace(/\*/g, '%').replace(/\?/g, '_');
}

function buildInClause(expr: SQL, values: string[]): SQL {
	return sql`${expr} IN (${sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	)})`;
}

function buildTextCondition(expr: SQL, filter: FilterCondition): SQL | undefined {
	switch (filter.operator) {
		case 'equals':
			return filter.value !== undefined ? sql`lower(${expr}) = lower(${filter.value})` : undefined;
		case 'not_equals':
			return filter.value !== undefined
				? sql`(${expr} IS NULL OR lower(${expr}) != lower(${filter.value}))`
				: undefined;
		case 'contains':
			return filter.value ? sql`${expr} LIKE ${'%' + escapeLikeLiteral(filter.value) + '%'}` : undefined;
		case 'not_contains':
			return filter.value
				? sql`(${expr} IS NULL OR ${expr} NOT LIKE ${'%' + escapeLikeLiteral(filter.value) + '%'})`
				: undefined;
		case 'starts_with':
			return filter.value ? sql`${expr} LIKE ${escapeLikeLiteral(filter.value) + '%'}` : undefined;
		case 'ends_with':
			return filter.value ? sql`${expr} LIKE ${'%' + escapeLikeLiteral(filter.value)}` : undefined;
		case 'wildcard':
			return filter.value ? sql`${expr} LIKE ${toWildcardPattern(filter.value)}` : undefined;
		case 'is_empty':
			return sql`(${expr} IS NULL OR ${expr} = '')`;
		case 'is_not_empty':
			return sql`(${expr} IS NOT NULL AND ${expr} != '')`;
		default:
			return undefined;
	}
}

function buildNumberCondition(expr: SQL, filter: FilterCondition): SQL | undefined {
	const n = filter.value !== undefined ? Number(filter.value) : undefined;
	const n2 = filter.value2 !== undefined ? Number(filter.value2) : undefined;
	switch (filter.operator) {
		case 'equals':
			return n !== undefined && Number.isFinite(n) ? sql`${expr} = ${n}` : undefined;
		case 'not_equals':
			return n !== undefined && Number.isFinite(n) ? sql`(${expr} IS NULL OR ${expr} != ${n})` : undefined;
		case 'gt':
			return n !== undefined && Number.isFinite(n) ? sql`${expr} > ${n}` : undefined;
		case 'gte':
			return n !== undefined && Number.isFinite(n) ? sql`${expr} >= ${n}` : undefined;
		case 'lt':
			return n !== undefined && Number.isFinite(n) ? sql`${expr} < ${n}` : undefined;
		case 'lte':
			return n !== undefined && Number.isFinite(n) ? sql`${expr} <= ${n}` : undefined;
		case 'between':
			return n !== undefined && n2 !== undefined && Number.isFinite(n) && Number.isFinite(n2)
				? sql`${expr} BETWEEN ${n} AND ${n2}`
				: undefined;
		case 'is_empty':
			return sql`${expr} IS NULL`;
		case 'is_not_empty':
			return sql`${expr} IS NOT NULL`;
		default:
			return undefined;
	}
}

/** `rawExpr` (nullable check) and `dateExpr` (day-level comparisons) target the same column pre/post DATE() cast. */
function buildDateCondition(rawExpr: SQL, dateExpr: SQL, filter: FilterCondition): SQL | undefined {
	switch (filter.operator) {
		case 'on':
			return filter.value ? sql`${dateExpr} = ${filter.value}` : undefined;
		case 'before':
			return filter.value ? sql`${dateExpr} < ${filter.value}` : undefined;
		case 'on_or_before':
			return filter.value ? sql`${dateExpr} <= ${filter.value}` : undefined;
		case 'after':
			return filter.value ? sql`${dateExpr} > ${filter.value}` : undefined;
		case 'on_or_after':
			return filter.value ? sql`${dateExpr} >= ${filter.value}` : undefined;
		case 'between':
			return filter.value && filter.value2 ? sql`${dateExpr} BETWEEN ${filter.value} AND ${filter.value2}` : undefined;
		case 'relative_last_days': {
			const days = filter.value !== undefined ? Number(filter.value) : undefined;
			return days !== undefined && Number.isFinite(days) && days > 0
				? sql`${dateExpr} >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`
				: undefined;
		}
		case 'is_empty':
			return sql`${rawExpr} IS NULL`;
		case 'is_not_empty':
			return sql`${rawExpr} IS NOT NULL`;
		default:
			return undefined;
	}
}

function buildBooleanCondition(field: FieldRow, expr: SQL, filter: FilterCondition): SQL | undefined {
	if (filter.operator !== 'equals' || filter.value === undefined) return undefined;
	const truthy = filter.value === 'true';
	// A slotted boolean mirrors as 0/1 in its generated column; the raw JSON value is a real
	// JSON true/false, which json_unquote renders as the literal string 'true'/'false'.
	return field.storageSlot ? sql`${expr} = ${truthy ? 1 : 0}` : sql`${expr} = ${truthy ? 'true' : 'false'}`;
}

function buildEqualityCondition(expr: SQL, filter: FilterCondition): SQL | undefined {
	switch (filter.operator) {
		case 'equals':
			return filter.value !== undefined ? sql`${expr} = ${filter.value}` : undefined;
		case 'not_equals':
			return filter.value !== undefined ? sql`(${expr} IS NULL OR ${expr} != ${filter.value})` : undefined;
		case 'in':
			return filter.values && filter.values.length > 0 ? buildInClause(expr, filter.values) : undefined;
		case 'is_empty':
			return sql`(${expr} IS NULL OR ${expr} = '')`;
		case 'is_not_empty':
			return sql`(${expr} IS NOT NULL AND ${expr} != '')`;
		default:
			return undefined;
	}
}

function buildFilterCondition(fieldByKey: Map<string, FieldRow>, filter: FilterCondition): SQL | undefined {
	if (filter.fieldKey === STATUS_FIELD_KEY) {
		if (filter.operator === 'equals' && filter.value) return sql`${record.status} = ${filter.value}`;
		if (filter.operator === 'in' && filter.values?.length) return buildInClause(sql`${record.status}`, filter.values);
		return undefined;
	}
	if (filter.fieldKey === CREATED_AT_FIELD_KEY) {
		return buildDateCondition(sql`${record.createdAt}`, sql`DATE(${record.createdAt})`, filter);
	}

	const field = fieldByKey.get(filter.fieldKey);
	if (!field) return undefined;

	switch (filterFieldType(field.dataType)) {
		case 'text':
			return buildTextCondition(columnExprFor(field), filter);
		case 'number':
			return buildNumberCondition(numericExprFor(field), filter);
		case 'date':
			return buildDateCondition(columnExprFor(field), dateExprFor(field), filter);
		case 'boolean':
			return buildBooleanCondition(field, columnExprFor(field), filter);
		default:
			return buildEqualityCondition(columnExprFor(field), filter);
	}
}

function sortExprFor(fieldByKey: Map<string, FieldRow>, sortKey: string): SQL | undefined {
	if (sortKey === STATUS_FIELD_KEY) return sql`${record.status}`;
	if (sortKey === CREATED_AT_FIELD_KEY) return sql`${record.createdAt}`;
	const field = fieldByKey.get(sortKey);
	if (!field) return undefined;
	return filterFieldType(field.dataType) === 'number' ? numericExprFor(field) : columnExprFor(field);
}

function groupExprFor(fieldByKey: Map<string, FieldRow>, groupBy: string): SQL {
	if (groupBy === STATUS_FIELD_KEY) return sql`${record.status}`;
	if (groupBy === CREATED_AT_FIELD_KEY) return sql`DATE(${record.createdAt})`;
	const field = fieldByKey.get(groupBy);
	return field ? columnExprFor(field) : sql`NULL`;
}

/**
 * Builds the full WHERE clause (base scoping + every AND-combined filter condition) and runs
 * either a detail listing or a grouped count/sum aggregation, per `config`.
 */
export async function runReport(
	organizationId: string,
	objectTypeId: string,
	fields: FieldRow[],
	config: ReportConfig
): Promise<DetailResult | GroupedResult> {
	const fieldByKey = new Map(fields.map((f) => [f.key, f]));

	const conditions = [
		eq(record.organizationId, organizationId),
		eq(record.objectTypeId, objectTypeId),
		isNull(record.deletedAt)
	];

	for (const filter of config.filters ?? []) {
		const condition = buildFilterCondition(fieldByKey, filter);
		if (condition) conditions.push(condition);
	}

	const where = and(...conditions);

	if (config.groupBy) {
		const groupExpr = groupExprFor(fieldByKey, config.groupBy);
		const aggregateField = config.aggregateField ? fieldByKey.get(config.aggregateField) : undefined;

		const rows = await db
			.select({
				group: groupExpr,
				count: sql<number>`count(*)`,
				...(aggregateField ? { sum: sql<number>`coalesce(sum(${numericExprFor(aggregateField)}), 0)` } : {})
			})
			.from(record)
			.where(where)
			.groupBy(groupExpr)
			.orderBy(desc(sql`count(*)`));

		return {
			mode: 'grouped',
			groupBy: config.groupBy,
			aggregateField: aggregateField?.key,
			rows: rows.map((r) => ({
				group: r.group == null ? '(empty)' : String(r.group),
				count: Number(r.count),
				sum: aggregateField ? Number((r as { sum?: number }).sum ?? 0) : undefined
			}))
		};
	}

	const dir = config.sortDirection === 'asc' ? asc : desc;
	let orderByExpr: SQL | ReturnType<typeof asc> = desc(record.createdAt);
	if (config.sortKey) {
		const expr = sortExprFor(fieldByKey, config.sortKey);
		if (expr) orderByExpr = dir(expr);
	}

	const [rows, [{ count }]] = await Promise.all([
		db.select().from(record).where(where).orderBy(orderByExpr).limit(DETAIL_ROW_LIMIT),
		db.select({ count: sql<number>`count(*)` }).from(record).where(where)
	]);

	return { mode: 'detail', rows, total: Number(count) };
}

function escapeCsvField(value: string): string {
	if (/[",\r\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function displayCsvValue(
	field: FieldRow,
	value: unknown,
	orgUserNames: Map<string, string>,
	lookupNames: Map<string, string>
): string {
	if (value === undefined || value === null || value === '') return '';
	if (field.dataType === 'boolean') return value ? 'Yes' : 'No';
	if (field.dataType === 'select') {
		return field.selectOptions?.find((o) => o.value === value)?.label ?? String(value);
	}
	if (field.dataType === 'user_reference') return orgUserNames.get(String(value)) ?? String(value);
	if (field.dataType === 'reference') return lookupNames.get(String(value)) ?? String(value);
	return String(value);
}

export function toCsv(
	fields: FieldRow[],
	rawColumns: string[],
	result: DetailResult | GroupedResult,
	orgUserNames: Map<string, string> = new Map(),
	lookupNames: Map<string, string> = new Map()
): string {
	let lines: string[][];
	// Mirrors the report page's own fallback: no explicit column selection shows status + every field.
	const columns = rawColumns.length > 0 ? rawColumns : [STATUS_FIELD_KEY, ...fields.map((f) => f.key)];

	if (result.mode === 'grouped') {
		const groupField = fields.find((f) => f.key === result.groupBy);
		const groupLabel = result.groupBy === '__status' ? 'Status' : result.groupBy === '__createdAt' ? 'Created' : groupField?.label ?? result.groupBy;
		const sumField = fields.find((f) => f.key === result.aggregateField);
		const header = sumField ? [groupLabel, 'Count', `Sum of ${sumField.label}`] : [groupLabel, 'Count'];
		lines = [
			header,
			...result.rows.map((r) => (sumField ? [r.group, String(r.count), String(r.sum ?? 0)] : [r.group, String(r.count)]))
		];
	} else {
		const selectedFields = columns
			.map((c) => fields.find((f) => f.key === c))
			.filter((f): f is FieldRow => !!f);

		const header = [
			...columns.map((c) => (c === '__status' ? 'Status' : c === '__createdAt' ? 'Created' : selectedFields.find((f) => f.key === c)?.label ?? c))
		];
		lines = [
			header,
			...result.rows.map((row) =>
				columns.map((c) => {
					if (c === '__status') return row.status.replace('_', ' ');
					if (c === '__createdAt') return new Date(row.createdAt).toLocaleDateString();
					const field = selectedFields.find((f) => f.key === c);
					return field ? displayCsvValue(field, row.data.values[field.key], orgUserNames, lookupNames) : '';
				})
			)
		];
	}

	return lines.map((line) => line.map(escapeCsvField).join(',')).join('\r\n');
}
