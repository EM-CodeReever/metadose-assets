import { createAccessControl } from 'better-auth/plugins/access';
import {
	defaultStatements as orgDefaultStatements,
	ownerAc,
	adminAc as orgAdminAc,
	memberAc
} from 'better-auth/plugins/organization/access';
import { defaultStatements as siteDefaultStatements, userAc } from 'better-auth/plugins/admin/access';

/**
 * Per-organization ("tenant") permissions. Extends better-auth's organization
 * statements (organization/member/invitation/team/ac) with our own domain
 * resources so a single access-control setup covers both org management and
 * asset-management permissions.
 */
export const orgStatement = {
	...orgDefaultStatements,
	objectType: ['create', 'update', 'archive', 'manage_fields'],
	record: ['create', 'read', 'update', 'delete', 'checkout', 'checkin'],
	report: ['create', 'read', 'update', 'delete'],
	attachment: ['create', 'delete'],
	checkoutRequest: ['create', 'read', 'approve', 'reject', 'cancel']
} as const;

export const orgAc = createAccessControl(orgStatement);

// Org creator — full control, including deleting the organization.
export const owner = orgAc.newRole({
	...ownerAc.statements,
	objectType: ['create', 'update', 'archive', 'manage_fields'],
	record: ['create', 'read', 'update', 'delete', 'checkout', 'checkin'],
	report: ['create', 'read', 'update', 'delete'],
	attachment: ['create', 'delete'],
	checkoutRequest: ['read', 'approve', 'reject', 'cancel']
});

// "org_admin" — schema/member management plus full record access, but can't delete the org.
export const admin = orgAc.newRole({
	...orgAdminAc.statements,
	objectType: ['create', 'update', 'archive', 'manage_fields'],
	record: ['create', 'read', 'update', 'delete', 'checkout', 'checkin'],
	report: ['create', 'read', 'update', 'delete'],
	attachment: ['create', 'delete'],
	checkoutRequest: ['read', 'approve', 'reject', 'cancel']
});

// "manager" — day-to-day asset operations, no schema or member management.
export const manager = orgAc.newRole({
	...memberAc.statements,
	record: ['create', 'read', 'update', 'checkout', 'checkin'],
	report: ['create', 'read', 'update', 'delete'],
	attachment: ['create', 'delete'],
	checkoutRequest: ['read', 'approve', 'reject', 'cancel']
});

// "viewer" — read-only.
export const viewer = orgAc.newRole({
	...memberAc.statements,
	record: ['read'],
	report: ['read']
});

// "member" — rank-and-file staff: no admin/schema/report access at all, just browsing to
// request an item and managing (create/cancel/read) their own requests.
export const member = orgAc.newRole({
	...memberAc.statements,
	record: ['read'],
	checkoutRequest: ['create', 'read', 'cancel']
});

export const orgRoles = { owner, admin, manager, viewer, member };

/**
 * Instance-wide (cross-tenant) permissions, for the better-auth `admin` plugin.
 * Separate resource domain (user/session management) from the org-level ac above —
 * a `super_admin` here can provision organizations and users; it is not an
 * organization membership role.
 */
export const siteStatement = { ...siteDefaultStatements } as const;

export const siteAc = createAccessControl(siteStatement);

export const superAdmin = siteAc.newRole({
	user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'delete', 'set-password', 'set-email', 'get', 'update'],
	session: ['list', 'revoke', 'delete']
});

export const siteRoles = { super_admin: superAdmin, user: userAc };
