<script lang="ts">
	import { browser } from '$app/environment';
	import { BookOpen, Boxes, Crown, Cpu, Eye, Keyboard, Package, ScanLine, Shield, ShieldCheck, User, UserCog } from '@lucide/svelte';
	import BrandLogo from '$lib/components/BrandLogo.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import { THEMES } from '$lib/stores/theme.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const toc = [
		{ id: 'overview', label: 'Overview & concepts' },
		{ id: 'roles', label: 'Roles & permissions' },
		{ id: 'browsing', label: 'Browsing & records' },
		{ id: 'checkouts', label: 'Checking out & checking in' },
		{ id: 'requests', label: 'Requesting items' },
		{ id: 'custom-types', label: 'Custom object types' },
		{ id: 'lookups', label: 'Manufacturers, categories, conditions & locations' },
		{ id: 'reports', label: 'Reports' },
		{ id: 'import-export', label: 'Import, export & labels' },
		{ id: 'logs', label: 'Activity logs' },
		{ id: 'org-users', label: 'Organization users' },
		{ id: 'instance-admin', label: 'Instance administration' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'faq', label: 'FAQ & troubleshooting' }
	];

	const roleTags: Record<string, { icon: typeof Crown; cls: string; label: string }> = {
		member: { icon: User, cls: 'badge-info', label: 'Member' },
		viewer: { icon: Eye, cls: 'badge-neutral', label: 'Viewer' },
		manager: { icon: UserCog, cls: 'badge-accent', label: 'Manager' },
		admin: { icon: ShieldCheck, cls: 'badge-secondary', label: 'Admin' },
		owner: { icon: Crown, cls: 'badge-primary', label: 'Owner' },
		instance: { icon: Shield, cls: 'badge-warning', label: 'Instance admin' }
	};

	// Scrollspy: tracks which section is currently under the sticky header so the TOC's rail
	// of nodes can show real reading progress, not just a static list of links. Driven directly
	// off scroll position (each section's distance from the sticky header) rather than
	// IntersectionObserver — the observer approach never fires for the *last* section once the
	// page is already scrolled to its max extent (there's nothing left to scroll that would push
	// that section's top into the observed band), which left the rail stuck on the
	// second-to-last topic for the whole rest of the page, including a direct click on it.
	let activeId = $state(toc[0].id);

	$effect(() => {
		if (!browser) return;
		const sections = toc.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => !!el);
		if (sections.length === 0) return;

		const HEADER_OFFSET = 100; // matches each section's scroll-mt-20

		let queued = false;
		function update() {
			queued = false;
			const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
			if (atBottom) {
				activeId = toc[toc.length - 1].id;
				return;
			}
			let current = sections[0].id;
			for (const el of sections) {
				if (el.getBoundingClientRect().top - HEADER_OFFSET <= 0) current = el.id;
				else break;
			}
			activeId = current;
		}
		function onScroll() {
			if (queued) return;
			queued = true;
			requestAnimationFrame(update);
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		update();
		return () => window.removeEventListener('scroll', onScroll);
	});

	const activeIndex = $derived(toc.findIndex((t) => t.id === activeId));
</script>

{#snippet roleBadges(roles: string[])}
	<div class="mt-1 mb-4 flex flex-wrap gap-1.5">
		{#each roles as r (r)}
			{@const t = roleTags[r]}
			<span class="badge {t.cls} badge-sm gap-1 font-normal">
				<t.icon size={11} />
				{t.label}
			</span>
		{/each}
	</div>
{/snippet}

<div class="bg-base-200 min-h-screen">
	<div class="navbar bg-base-100 border-base-300 sticky top-0 z-30 border-b px-4">
		<div class="flex flex-1 items-center gap-3">
			<a href="/" aria-label="Back to app"><BrandLogo width={100} /></a>
			<span class="text-base-content/30">/</span>
			<span class="flex items-center gap-1.5 font-semibold">
				<BookOpen size={16} />
				Documentation
			</span>
		</div>
		<div class="flex items-center gap-2">
			<ThemeSwitcher />
			<a href="/" class="btn btn-ghost btn-sm">Back to app</a>
		</div>
	</div>

	<!-- Mobile jump menu -->
	<div class="border-base-300 bg-base-100 border-b p-3 lg:hidden">
		<select
			class="select select-sm w-full"
			onchange={(e) => document.getElementById(e.currentTarget.value)?.scrollIntoView({ behavior: 'smooth' })}
		>
			<option value="">Jump to section…</option>
			{#each toc as t (t.id)}
				<option value={t.id}>{t.label}</option>
			{/each}
		</select>
	</div>

	<div class="mx-auto flex max-w-6xl gap-8 px-6 py-8">
		<!-- TOC -->
		<nav class="sticky top-20 hidden h-fit w-64 shrink-0 lg:block">
			<p class="md-label mb-2">On this page</p>
			<ul class="border-base-300 relative space-y-0.5 border-l text-sm">
				{#each toc as t, i (t.id)}
					{@const isActive = i === activeIndex}
					{@const isPast = i < activeIndex}
					<li class="relative">
						<span
							class="absolute top-1/2 -left-1.25 size-2.5 -translate-y-1/2 rounded-full border-2 transition-all duration-200 {isActive
								? 'bg-primary border-primary scale-110'
								: isPast
									? 'bg-primary/50 border-primary/50'
									: 'bg-base-100 border-base-300'}"
						></span>
						<a
							href="#{t.id}"
							class="block py-1 pl-4 transition-colors {isActive
								? 'text-primary font-medium'
								: 'text-base-content/70 hover:text-primary'}"
						>
							{t.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<!-- Content -->
		<main class="min-w-0 flex-1 space-y-14 pb-24">
			<header>
				<h1 class="md-display">metadose-assets documentation</h1>
				<p class="md-body mt-2 max-w-2xl">
					Everything you need to track assets, accessories, consumables, components and your own
					custom object types across one or more organizations — from everyday checkouts to
					instance-wide administration. Sections are tagged with the roles they apply to, so skim
					past what doesn't concern you.
				</p>
				<p class="text-base-content/50 mt-3 text-xs">
					Signed in as {data.user.name} · {data.user.role === 'super_admin' ? 'Instance admin' : 'User'}
				</p>
			</header>

			<!-- ───────────────────────── OVERVIEW ───────────────────────── -->
			<section id="overview" class="scroll-mt-20">
				<h2 class="md-heading-1">Overview & concepts</h2>
				{@render roleBadges(['member', 'viewer', 'manager', 'admin', 'owner', 'instance'])}

				<p class="md-body">
					The app is organized around <strong>organizations</strong> (tenants) — each organization has
					its own users, assets, schema and settings, completely isolated from every other
					organization. An <strong>instance admin</strong> sits above all organizations: they
					provision organizations and users instance-wide, but (deliberately) cannot hold or be
					assigned any asset themselves — see
					<a href="#instance-admin" class="md-link">Instance administration</a>.
				</p>

				<h3 class="md-heading-3 mt-6">Object types</h3>
				<p class="md-body">
					Everything you track is a <strong>record</strong> of some <strong>object type</strong>.
					Four built-in types cover the common cases, and you can define your own custom types on
					top of them.
				</p>
				<div class="overflow-x-auto">
					<table class="table mt-3">
						<thead>
							<tr>
								<th>Type</th>
								<th>Tracked</th>
								<th>Checked out to</th>
								<th>Returned?</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td class="flex items-center gap-2"><Boxes size={15} /> Asset</td>
								<td>Individually (one row per physical item)</td>
								<td>A user <em>or</em> a location</td>
								<td>Yes</td>
							</tr>
							<tr>
								<td class="flex items-center gap-2"><Keyboard size={15} /> Accessory</td>
								<td>In bulk, by quantity</td>
								<td>A user</td>
								<td>Yes</td>
							</tr>
							<tr>
								<td class="flex items-center gap-2"><Package size={15} /> Consumable</td>
								<td>In bulk, by quantity</td>
								<td>A user</td>
								<td>No — quantity is spent, not returned</td>
							</tr>
							<tr>
								<td class="flex items-center gap-2"><Cpu size={15} /> Component</td>
								<td>In bulk, by quantity</td>
								<td>Another asset (it installs <em>into</em> it)</td>
								<td>Yes (uninstall)</td>
							</tr>
						</tbody>
					</table>
				</div>

				<h3 class="md-heading-3 mt-6">Custom object types</h3>
				<p class="md-body">
					Beyond the four built-ins, an admin/owner can define custom types (e.g. "Vehicles",
					"Software Licenses") under <a href="#custom-types" class="md-link">Custom object types</a>.
					Each custom type picks one of two tracking modes that make it behave like an asset or
					like an accessory:
				</p>
				<ul class="md-body list-disc space-y-1 pl-5">
					<li><strong>Individually tracked</strong> — one row per unit, assignable to a user or location, just like Assets. Optionally allows components to be installed into it.</li>
					<li><strong>Tracked in bulk by quantity</strong> — a single row represents many units, and one of its number fields (you choose which, e.g. "Seats" on a license type) stands in for quantity, just like Accessories.</li>
				</ul>
			</section>

			<!-- ───────────────────────── ROLES ───────────────────────── -->
			<section id="roles" class="scroll-mt-20">
				<h2 class="md-heading-1">Roles & permissions</h2>
				{@render roleBadges(['member', 'viewer', 'manager', 'admin', 'owner', 'instance'])}

				<p class="md-body">
					Every person who belongs to an organization has exactly one role in it (the same person
					can hold a different role in a different organization). Roles are ordered from least to
					most privileged:
				</p>
				<div class="overflow-x-auto">
					<table class="table mt-3">
						<thead>
							<tr>
								<th>Role</th>
								<th>Can do</th>
								<th>Cannot do</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td><span class="badge badge-info badge-sm gap-1"><User size={11} />Member</span></td>
								<td>Browse available assets/accessories/consumables, request one, cancel their own pending requests, confirm receipt of what's assigned to them</td>
								<td>Everything administrative — no checkout, schema, reports, or components access</td>
							</tr>
							<tr>
								<td><span class="badge badge-neutral badge-sm gap-1"><Eye size={11} />Viewer</span></td>
								<td>Read-only access to records and reports</td>
								<td>Any change — no checkout, create, edit, or approve</td>
							</tr>
							<tr>
								<td><span class="badge badge-accent badge-sm gap-1"><UserCog size={11} />Manager</span></td>
								<td>Day-to-day operations: create/edit records, check items in and out, approve/reject requests, manage reports</td>
								<td>Schema changes, member management</td>
							</tr>
							<tr>
								<td><span class="badge badge-secondary badge-sm gap-1"><ShieldCheck size={11} />Admin</span></td>
								<td>Everything a Manager can, plus schema (custom types/fields), lookup values, and member management</td>
								<td>Delete the organization itself</td>
							</tr>
							<tr>
								<td><span class="badge badge-primary badge-sm gap-1"><Crown size={11} />Owner</span></td>
								<td>Everything, including deleting the organization</td>
								<td>—</td>
							</tr>
							<tr>
								<td><span class="badge badge-warning badge-sm gap-1"><Shield size={11} />Instance admin</span></td>
								<td>Create organizations and users instance-wide; can open any organization with read-through "support access"</td>
								<td>Hold or be assigned any asset/accessory/consumable/component, anywhere</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="alert mt-4 text-sm">
					<span>
						An instance admin opening an organization they don't belong to sees a
						<span class="badge badge-warning badge-sm">Support access</span> badge in the top bar —
						a reminder that they're there to help, not as a member.
					</span>
				</div>
			</section>

			<!-- ───────────────────────── BROWSING ───────────────────────── -->
			<section id="browsing" class="scroll-mt-20">
				<h2 class="md-heading-1">Browsing & records</h2>
				{@render roleBadges(['member', 'viewer', 'manager', 'admin', 'owner'])}

				<p class="md-body">
					Each object type has a list page with search and column filters, and every record has its
					own detail page. From the list page you can also export the current view to CSV.
				</p>
				<h3 class="md-heading-3 mt-6">The record detail page</h3>
				<ul class="md-body list-disc space-y-1 pl-5">
					<li><strong>Fields</strong> — every custom and built-in field on the record, editable in place by anyone with update access.</li>
					<li><strong>Installed components</strong> — shown as its own section under Fields for any asset-like record that allows components; lists what's currently installed with an uninstall action.</li>
					<li><strong>Attachments</strong> — upload/download files attached to the record (photos, invoices, manuals).</li>
					<li><strong>History</strong> — every checkout/checkin/edit event for this specific record.</li>
					<li><strong>Label</strong> — a printable label with the record's name and a scannable code, for asset tags.</li>
				</ul>
			</section>

			<!-- ───────────────────────── CHECKOUTS ───────────────────────── -->
			<section id="checkouts" class="scroll-mt-20">
				<h2 class="md-heading-1">Checking out & checking in</h2>
				{@render roleBadges(['manager', 'admin', 'owner'])}

				<p class="md-body">
					What a checkout looks like depends on the record's kind (see
					<a href="#overview" class="md-link">Overview</a>):
				</p>
				<ul class="md-body list-disc space-y-1 pl-5">
					<li><strong>Assets</strong> (and individually-tracked custom types) — assign the whole record to a user <em>or</em> a location, optionally with a due date. Checking a location-assigned asset out to a user still requires picking which location it's physically at.</li>
					<li><strong>Accessories / consumables</strong> (and bulk custom types) — check out some quantity to a user; consumables are simply spent and never checked back in, accessories are returned later.</li>
					<li><strong>Components</strong> — check a quantity out <em>into</em> a specific asset (or asset-like custom type that allows it) rather than to a person.</li>
				</ul>

				<h3 class="md-heading-3 mt-6">Condition on check-in</h3>
				<p class="md-body">
					When an accessory/component unit comes back in a different condition than the rest of the
					batch, check it in under that condition and the system automatically splits it into its
					own record — so "5 good, 1 damaged" is tracked precisely instead of as one lump quantity.
				</p>

				<h3 class="md-heading-3 mt-6">Out-of-service warning</h3>
				<p class="md-body">
					Conditions can be flagged <strong>out of service</strong> (meaning items split into that
					condition are taken out of circulation). This doesn't block an assignment outright, but
					the checkout dialog shows a warning banner so whoever's assigning it knows the item is
					flagged out of service before they proceed.
				</p>
			</section>

			<!-- ───────────────────────── REQUESTS ───────────────────────── -->
			<section id="requests" class="scroll-mt-20">
				<h2 class="md-heading-1">Requesting items</h2>
				{@render roleBadges(['member', 'manager', 'admin', 'owner'])}

				<p class="md-body">
					Members (and anyone else, informally) can request an available asset, accessory or
					consumable instead of being assigned one directly — components can't be requested, since
					they're installed into an asset rather than handed to a person.
				</p>
				<ol class="md-body list-decimal space-y-1 pl-5">
					<li>The requester opens the item and clicks <strong>Request</strong>, with an optional note.</li>
					<li>It shows up under <strong>Requests</strong> for any Manager/Admin/Owner to review.</li>
					<li>Approving it performs the actual checkout (picking a location for asset-kind items, a quantity for bulk ones); rejecting it records an optional reason.</li>
					<li>The requester can cancel their own request while it's still pending.</li>
					<li>Once something is checked out to you personally, you'll see a <strong>Confirm receipt</strong> button on that record until you acknowledge it.</li>
				</ol>
			</section>

			<!-- ───────────────────────── CUSTOM TYPES ───────────────────────── -->
			<section id="custom-types" class="scroll-mt-20">
				<h2 class="md-heading-1">Custom object types</h2>
				{@render roleBadges(['admin', 'owner'])}

				<p class="md-body">
					Under <strong>Manage → Schema</strong>, define new object types for anything the four
					built-ins don't cover. Each one has:
				</p>
				<ul class="md-body list-disc space-y-1 pl-5">
					<li><strong>Tracking mode</strong> — Individually (asset-like) or By quantity (accessory-like); see <a href="#overview" class="md-link">Overview</a>.</li>
					<li><strong>A quantity field</strong> (bulk types only) — pick which of your number fields represents how many units a record stands for.</li>
					<li><strong>Allow component install</strong> (individually-tracked types only) — lets Components be installed into records of this type, same as a real Asset.</li>
					<li><strong>Fields</strong> — add/reorder/remove fields of various data types (text, number, date, boolean, select, reference to a lookup, user reference), each independently markable required or not.</li>
				</ul>
				<p class="md-body mt-3">
					Custom types can be archived (hidden from day-to-day use without deleting their history)
					from the same Schema page.
				</p>
			</section>

			<!-- ───────────────────────── LOOKUPS ───────────────────────── -->
			<section id="lookups" class="scroll-mt-20">
				<h2 class="md-heading-1">Manufacturers, categories, conditions & locations</h2>
				{@render roleBadges(['admin', 'owner'])}

				<p class="md-body">
					These four lookup lists (under <strong>Manage</strong>) back the matching reference fields
					on records. Conditions additionally have an <strong>out of service</strong> flag (see
					<a href="#checkouts" class="md-link">Checking out & checking in</a>). Rather than leaving
					the manage pages, you can quick-add a new condition or location directly from its
					dropdown while filling out a form — type a name that doesn't exist yet and an "Add
					'…'" option appears inline.
				</p>
			</section>

			<!-- ───────────────────────── REPORTS ───────────────────────── -->
			<section id="reports" class="scroll-mt-20">
				<h2 class="md-heading-1">Reports</h2>
				{@render roleBadges(['viewer', 'manager', 'admin', 'owner'])}

				<p class="md-body">
					A report is a saved view over one object type: pick which columns to show and how to
					filter, save it with a name, and re-run it any time — or export its current results to
					CSV. Viewers can read existing reports; creating, editing and deleting them needs Manager
					or above.
				</p>
			</section>

			<!-- ───────────────────────── IMPORT/EXPORT ───────────────────────── -->
			<section id="import-export" class="scroll-mt-20">
				<h2 class="md-heading-1">Import, export & labels</h2>
				{@render roleBadges(['manager', 'admin', 'owner'])}

				<h3 class="md-heading-3">CSV import</h3>
				<p class="md-body">
					Every object type's list page has an <strong>Import</strong> action: download a CSV
					template pre-filled with that type's current fields and one example row, fill it in, then
					upload it for a row-by-row preview before committing. Failed rows are reported individually
					so the rest of the batch still goes through.
				</p>
				<h3 class="md-heading-3 mt-6">CSV export</h3>
				<p class="md-body">
					The list page's <strong>Export</strong> action downloads exactly the rows and columns
					currently visible (after your search/filters), as CSV.
				</p>
				<h3 class="md-heading-3 mt-6">Scan</h3>
				<p class="md-body">
					<ScanLine size={14} class="mb-0.5 inline" /> <strong>Scan</strong> in the sidebar looks a record
					up instantly by its barcode/QR code — either via your device's camera (where supported) or
					by typing/wedge-scanning the code into a text box — then jumps straight to that record.
				</p>
				<h3 class="md-heading-3 mt-6">Labels</h3>
				<p class="md-body">
					Every record's detail page has a printable <strong>Label</strong> view with its name and a
					scannable code, sized for common label stock, for tagging physical items.
				</p>
			</section>

			<!-- ───────────────────────── LOGS ───────────────────────── -->
			<section id="logs" class="scroll-mt-20">
				<h2 class="md-heading-1">Activity logs</h2>
				{@render roleBadges(['admin', 'owner', 'instance'])}

				<p class="md-body">
					<strong>Logs</strong> is a full, filterable history of everything that happened in the
					organization — checkouts/check-ins, record and schema changes, user and membership
					changes — each entry showing who did it and when. Instance admins additionally have
					cross-organization access to every organization's logs from the admin console.
				</p>
			</section>

			<!-- ───────────────────────── ORG USERS ───────────────────────── -->
			<section id="org-users" class="scroll-mt-20">
				<h2 class="md-heading-1">Organization users</h2>
				{@render roleBadges(['admin', 'owner'])}

				<p class="md-body">
					Under <strong>Users</strong>, Admins/Owners add existing people to the organization and
					set their role, search/filter the member list by role or auth method, and remove members.
					New <em>accounts</em> (as opposed to adding an existing person to this organization) are
					created instance-wide by an instance admin — see
					<a href="#instance-admin" class="md-link">Instance administration</a>.
				</p>
			</section>

			<!-- ───────────────────────── INSTANCE ADMIN ───────────────────────── -->
			<section id="instance-admin" class="scroll-mt-20">
				<h2 class="md-heading-1">Instance administration</h2>
				{@render roleBadges(['instance'])}

				<p class="md-body">
					The admin console (<code class="md-code-inline">/admin</code>) is only reachable by
					instance admins and manages the whole instance rather than any one organization.
				</p>

				<h3 class="md-heading-3 mt-6">Organizations</h3>
				<p class="md-body">
					Create organizations, open any of them with read-through support access, and (owners
					aside) manage them from the outside.
				</p>

				<h3 class="md-heading-3 mt-6">Users</h3>
				<p class="md-body">
					Create individual accounts (choosing <strong>User</strong> or <strong>Instance admin</strong>,
					a password set directly or emailed as a set-your-own-password link, and optionally
					requiring a password change on first sign-in), or bulk-import many at once from CSV.
					Deleting a user either removes them outright (if they have no history anywhere) or
					anonymizes them — scrubbing name/email, revoking access, and removing every organization
					membership — while leaving the historical records they're attached to (checkouts, activity,
					created items) intact. Banning instead of deleting temporarily blocks sign-in without
					touching history at all.
				</p>
				<div class="alert mt-3 text-sm">
					<span>
						Instance admins can never hold or be assigned an asset, accessory, consumable or
						component, anywhere — by design, so the role stays a pure "keep the system running"
						role rather than becoming part of any organization's day-to-day operations.
					</span>
				</div>

				<h3 class="md-heading-3 mt-6">Settings</h3>
				<ul class="md-body list-disc space-y-1 pl-5">
					<li><strong>Email (SMTP)</strong> — outgoing mail server for password-reset/invite emails, with a "send test email" check.</li>
					<li><strong>LDAP</strong> — connect a directory, test the connection, and sync users in (create-or-match by email), optionally bulk-adding everyone synced to one organization/role in the same pass. Accounts synced this way authenticate live against the directory at every sign-in rather than storing a local password.</li>
					<li><strong>Timezone</strong> — the instance-wide timezone every timestamp is displayed in throughout the app.</li>
				</ul>
			</section>

			<!-- ───────────────────────── APPEARANCE ───────────────────────── -->
			<section id="appearance" class="scroll-mt-20">
				<h2 class="md-heading-1">Appearance</h2>
				{@render roleBadges(['member', 'viewer', 'manager', 'admin', 'owner', 'instance'])}

				<p class="md-body">
					The palette icon in the top bar switches between {THEMES.length} themes — each one is a
					personal, per-browser preference (not shared with anyone else) and applies instantly:
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each THEMES as t (t)}
						<span data-theme={t} class="bg-base-100 border-base-300 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs shadow-sm">
							<span class="bg-primary size-2 rounded-full"></span>
							<span class="bg-secondary size-2 rounded-full"></span>
							<span class="bg-accent size-2 rounded-full"></span>
							<span class="text-base-content ml-1 capitalize">{t}</span>
						</span>
					{/each}
				</div>
			</section>

			<!-- ───────────────────────── FAQ ───────────────────────── -->
			<section id="faq" class="scroll-mt-20">
				<h2 class="md-heading-1">FAQ & troubleshooting</h2>
				{@render roleBadges(['member', 'viewer', 'manager', 'admin', 'owner', 'instance'])}

				<div class="join join-vertical mt-3 w-full">
					<div class="collapse-arrow join-item border-base-300 collapse border">
						<input type="radio" name="faq-accordion" />
						<div class="collapse-title font-medium">Why can't I check an asset out to myself?</div>
						<div class="collapse-content text-base-content/70 text-sm">
							<p>
								Members can't perform checkouts directly — request the item instead (see
								<a href="#requests" class="md-link">Requesting items</a>) and have a
								Manager/Admin/Owner approve it. If you hold one of those roles and still can't,
								check that you're not signed in as an instance admin — that role can never be
								assigned anything, anywhere, by design.
							</p>
						</div>
					</div>
					<div class="collapse-arrow join-item border-base-300 collapse border">
						<input type="radio" name="faq-accordion" />
						<div class="collapse-title font-medium">
							What's the difference between an accessory and a consumable?
						</div>
						<div class="collapse-content text-base-content/70 text-sm">
							<p>
								Both are tracked by quantity rather than as individual units. Accessories are
								checked back in when returned (like a batch of headsets); consumables are simply
								spent and never return (like printer paper).
							</p>
						</div>
					</div>
					<div class="collapse-arrow join-item border-base-300 collapse border">
						<input type="radio" name="faq-accordion" />
						<div class="collapse-title font-medium">A condition split created an extra record — is that a bug?</div>
						<div class="collapse-content text-base-content/70 text-sm">
							<p>
								No — that's intentional. Checking in part of a quantity under a different
								condition than the rest automatically creates a sibling record for that
								condition, so quantities in different conditions are never silently merged
								together. See <a href="#checkouts" class="md-link">Checking out & checking in</a>.
							</p>
						</div>
					</div>
					<div class="collapse-arrow join-item border-base-300 collapse border">
						<input type="radio" name="faq-accordion" />
						<div class="collapse-title font-medium">I deleted a user, but records still show their name. Why?</div>
						<div class="collapse-content text-base-content/70 text-sm">
							<p>
								That account had history somewhere (a checkout, a created record, activity), so
								it was anonymized rather than deleted outright — their name/email are scrubbed
								and access is fully revoked, but historical rows they're attached to keep
								pointing at the (now-anonymous) account instead of losing attribution entirely.
							</p>
						</div>
					</div>
					<div class="collapse-arrow join-item border-base-300 collapse border">
						<input type="radio" name="faq-accordion" />
						<div class="collapse-title font-medium">The camera scanner isn't working.</div>
						<div class="collapse-content text-base-content/70 text-sm">
							<p>
								Live camera scanning relies on a browser API currently only available in
								Chrome/Edge/Android. On an unsupported browser (notably Safari/iOS today), use
								the manual code-entry box on the same <strong>Scan</strong> page instead — it
								works everywhere.
							</p>
						</div>
					</div>
				</div>
			</section>
		</main>
	</div>
</div>
