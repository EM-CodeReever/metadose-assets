#!/usr/bin/env bash
# metadose-assets — deployment helper. Only needs docker-compose.hub.yml next to it; no source
# tree required. Usage:
#
#   ./docker-manage.sh setup     interactive first-time setup: writes .env, brings the stack up,
#                                creates the first admin account
#   ./docker-manage.sh admin     create an additional account later (no full setup needed)
#   ./docker-manage.sh up        start (detached)
#   ./docker-manage.sh down      stop
#   ./docker-manage.sh restart   down + up
#   ./docker-manage.sh logs      follow the app container's logs
#   ./docker-manage.sh update    pull the latest image and restart
#   ./docker-manage.sh reset     wipe the database/uploads volumes and start clean (destructive)
#
set -euo pipefail

COMPOSE_FILE="docker-compose.hub.yml"
ENV_FILE=".env"

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

require_compose_file() {
	if [ ! -f "$COMPOSE_FILE" ]; then
		echo "Missing $COMPOSE_FILE in $(pwd) — copy it next to this script first." >&2
		exit 1
	fi
}

require_env_file() {
	if [ ! -f "$ENV_FILE" ]; then
		echo "No $ENV_FILE yet — run '$0 setup' first." >&2
		exit 1
	fi
}

# Docker Compose does its own substitution pass over .env values once they're interpolated into
# the compose file — a literal `$` in a hand-typed value (an SMTP password, say) would otherwise
# be misread as the start of another variable reference and silently dropped, corrupting it. `$$`
# is Compose's own escape for a literal dollar sign.
escape_dollar() { printf '%s' "$1" | sed 's/\$/$$/g'; }

wait_for_healthy() {
	# A first boot has to pull the image (if newer), wait for MySQL, then run every migration —
	# comfortably over a minute isn't unusual, so this waits up to 5 minutes rather than bailing
	# early. Under `set -e`, returning non-zero here would otherwise silently skip the admin-account
	# prompt entirely with nothing but an easy-to-miss stderr line to show for it.
	local port="$1" tries=150
	echo -n "Waiting for the app to come up (can take a few minutes on a first boot)"
	while [ $tries -gt 0 ]; do
		if curl -fsS "http://localhost:${port}/api/health" >/dev/null 2>&1; then
			echo " ready."
			return 0
		fi
		echo -n "."
		sleep 2
		tries=$((tries - 1))
	done
	echo
	echo "Still not responding after 5 minutes — check: $0 logs" >&2
	echo "Once it's actually up, create the admin account with: $0 admin" >&2
	return 1
}

create_admin_account() {
	echo
	echo "Create the first admin account (instance admin — manages the whole deployment):"
	read -rp "  Name: " admin_name
	read -rp "  Email: " admin_email
	while true; do
		read -rsp "  Password (min 8 characters): " admin_pass; echo
		if [ ${#admin_pass} -lt 8 ]; then
			echo "  Too short, try again."
			continue
		fi
		read -rsp "  Confirm password: " admin_pass2; echo
		[ "$admin_pass" = "$admin_pass2" ] && break
		echo "  Didn't match, try again."
	done

	dc exec -T app node_modules/.bin/tsx scripts/seed-super-admin.ts "$admin_email" "$admin_pass" "$admin_name"
	echo
	echo "Done. Sign in at your ORIGIN URL (the INT Admin tab) as $admin_email."
}

cmd_setup() {
	require_compose_file

	if [ -f "$ENV_FILE" ]; then
		# MySQL only ever sets its root password while initializing an empty data directory — if
		# a stack was already brought up once (even if it then failed), that volume already has a
		# password baked in. Regenerating secrets below without also wiping it would leave the new
		# .env permanently out of sync with what the database will actually accept, which looks
		# like "Access denied for user 'root'" and crash-loops forever. So this has to be an
		# explicit, scarier confirmation than a plain file overwrite.
		local existing="not-set"
		if [ -n "$(dc ps -aq 2>/dev/null)" ]; then existing="found"; fi
		if [ "$existing" = "found" ]; then
			echo "An existing stack (containers/volumes) was found from a previous setup."
			read -rp "Re-running setup will generate NEW secrets and wipe the existing database/uploads so they stay in sync — type RESET to confirm: " confirm
			[ "$confirm" = "RESET" ] || { echo "Leaving everything as-is."; exit 0; }
			dc down -v
		else
			read -rp "$ENV_FILE already exists — overwrite it? [y/N] " overwrite
			[ "$overwrite" = "y" ] || [ "$overwrite" = "Y" ] || { echo "Leaving it as-is."; exit 0; }
		fi
	fi

	echo "metadose-assets — first-time setup"
	echo "-----------------------------------"
	read -rp "Public address this will be reached at, including scheme (e.g. https://assets.example.com or http://192.168.1.50:3000): " origin
	read -rp "Port to publish on this host [3000]: " app_port
	app_port="${app_port:-3000}"
	read -rp "MySQL database name [metadose_assets]: " mysql_db
	mysql_db="${mysql_db:-metadose_assets}"

	# Always machine-generated, never typed by hand — a hand-typed secret containing $, @, :, or /
	# can corrupt the Compose env-file interpolation or the DATABASE_URL connection string.
	local mysql_root_password better_auth_secret
	mysql_root_password="$(openssl rand -hex 24)"
	better_auth_secret="$(openssl rand -hex 32)"

	echo
	read -rp "Configure outgoing email (SMTP) now? [y/N] " want_smtp
	local smtp_host="" smtp_port="" smtp_secure="false" smtp_user="" smtp_pass="" smtp_from=""
	if [ "$want_smtp" = "y" ] || [ "$want_smtp" = "Y" ]; then
		read -rp "  SMTP host: " smtp_host
		read -rp "  SMTP port [587]: " smtp_port
		smtp_port="${smtp_port:-587}"
		read -rp "  Use TLS? (usually only for port 465) [y/N] " smtp_tls
		[ "$smtp_tls" = "y" ] || [ "$smtp_tls" = "Y" ] && smtp_secure="true"
		read -rp "  SMTP username: " smtp_user
		read -rsp "  SMTP password: " smtp_pass; echo
		read -rp "  From address [no-reply@localhost]: " smtp_from
		smtp_from="${smtp_from:-no-reply@localhost}"
	fi

	cat > "$ENV_FILE" << EOF
MYSQL_ROOT_PASSWORD=${mysql_root_password}
MYSQL_DATABASE=$(escape_dollar "$mysql_db")
BETTER_AUTH_SECRET=${better_auth_secret}
ORIGIN=$(escape_dollar "$origin")
APP_PORT=${app_port}
SMTP_HOST=$(escape_dollar "$smtp_host")
SMTP_PORT=${smtp_port}
SMTP_SECURE=${smtp_secure}
SMTP_USER=$(escape_dollar "$smtp_user")
SMTP_PASS=$(escape_dollar "$smtp_pass")
SMTP_FROM=$(escape_dollar "$smtp_from")
EOF
	chmod 600 "$ENV_FILE"
	echo "Wrote $ENV_FILE (secrets machine-generated, not shown above)."

	echo
	echo "Pulling the image and starting the stack..."
	dc up -d
	wait_for_healthy "$app_port"
	create_admin_account
}

cmd_admin() { require_env_file; create_admin_account; }
cmd_up() { require_compose_file; require_env_file; dc up -d; }
cmd_down() { require_compose_file; require_env_file; dc down; }
cmd_restart() { require_compose_file; require_env_file; dc down; dc up -d; }
cmd_logs() { require_compose_file; require_env_file; dc logs -f app; }
cmd_update() { require_compose_file; require_env_file; dc pull; dc up -d; }

cmd_reset() {
	require_compose_file
	require_env_file
	echo "This deletes the database and uploaded files, keeping your current .env (same secrets)."
	read -rp "Type RESET to confirm: " confirm
	[ "$confirm" = "RESET" ] || { echo "Cancelled."; exit 0; }
	dc down -v
	dc up -d
	wait_for_healthy "$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2-)"
	echo "Clean. Run '$0 admin' to create the first account."
}

case "${1:-}" in
	setup) cmd_setup ;;
	admin) cmd_admin ;;
	up) cmd_up ;;
	down) cmd_down ;;
	restart) cmd_restart ;;
	logs) cmd_logs ;;
	update) cmd_update ;;
	reset) cmd_reset ;;
	*)
		echo "Usage: $0 {setup|admin|up|down|restart|logs|update|reset}" >&2
		exit 1
		;;
esac
