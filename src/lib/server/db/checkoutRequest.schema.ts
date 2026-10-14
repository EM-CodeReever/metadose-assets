import { relations } from 'drizzle-orm';
import { mysqlTable, varchar, text, timestamp, mysqlEnum, index } from 'drizzle-orm/mysql-core';
import { organization, user } from './auth.schema';
import { record } from './record.schema';
import { checkout } from './checkout.schema';

/**
 * A member's request to be assigned a specific available record — distinct from `checkout`,
 * which is the real, immediate assignment an admin/manager performs. Approving a request creates
 * a `checkout` row (linked via `fulfilledCheckoutId`); this row stays around as the audit trail
 * of who asked for what and who decided it.
 */
export const checkoutRequest = mysqlTable(
	'checkout_request',
	{
		id: varchar('id', { length: 36 }).primaryKey(),
		organizationId: varchar('organization_id', { length: 36 })
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		recordId: varchar('record_id', { length: 36 })
			.notNull()
			.references(() => record.id, { onDelete: 'cascade' }),
		requestedByUserId: varchar('requested_by_user_id', { length: 36 })
			.notNull()
			.references(() => user.id),
		status: mysqlEnum('status', ['pending', 'fulfilled', 'rejected', 'cancelled']).default('pending').notNull(),
		note: text('note'),
		decisionNote: text('decision_note'),
		decidedBy: varchar('decided_by', { length: 36 }).references(() => user.id),
		decidedAt: timestamp('decided_at', { fsp: 3 }),
		// 'set null', not cascade: this row is kept as an audit trail of who asked for what and
		// who decided it, which should outlive the checkout it fulfilled if that's ever removed.
		fulfilledCheckoutId: varchar('fulfilled_checkout_id', { length: 36 }).references(() => checkout.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull()
	},
	(t) => [
		index('checkout_request_org_status_idx').on(t.organizationId, t.status),
		index('checkout_request_requester_idx').on(t.organizationId, t.requestedByUserId)
	]
);

export const checkoutRequestRelations = relations(checkoutRequest, ({ one }) => ({
	record: one(record, { fields: [checkoutRequest.recordId], references: [record.id] }),
	requestedByUser: one(user, { fields: [checkoutRequest.requestedByUserId], references: [user.id] }),
	decidedByUser: one(user, { fields: [checkoutRequest.decidedBy], references: [user.id] }),
	fulfilledCheckout: one(checkout, { fields: [checkoutRequest.fulfilledCheckoutId], references: [checkout.id] })
}));
