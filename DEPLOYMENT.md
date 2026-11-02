# Deploying metadose-assets

Runs from the published Docker Hub image (`emprocoder/metadose-assets`) — no source tree, no
build step. Install Docker itself first if needed: **https://docs.docker.com/engine/install/**
(the Compose plugin is bundled with it).

## What you need on the server

Just two files, copied anywhere (scp/curl/paste):

- [`docker-compose.hub.yml`](./docker-compose.hub.yml)
- [`docker-manage.sh`](./docker-manage.sh)

```bash
chmod +x docker-manage.sh
./docker-manage.sh setup
```

That one command prompts you for the address this instance will be reached at, the DB name,
optional SMTP details, then writes `.env`, pulls the image, brings the stack up, waits for it to
report healthy, and walks you through creating the first admin account. Secrets
(`MYSQL_ROOT_PASSWORD`, `BETTER_AUTH_SECRET`) are always machine-generated, never typed by hand —
a hand-typed secret containing `$`, `@`, `:`, or `/` can corrupt the `.env`/Compose interpolation
or the database connection string.

If `emprocoder/metadose-assets` is private on Docker Hub, `docker login` on the server before
running `setup`.

## Day to day

```bash
./docker-manage.sh up        # start
./docker-manage.sh down      # stop
./docker-manage.sh restart   # restart
./docker-manage.sh logs      # follow the app's logs
./docker-manage.sh update    # pull the latest image and restart
./docker-manage.sh admin     # create another admin/user account later
```

## `.env` reference

Written for you by `setup`, but here's what each value is if you need to hand-edit it later
(then `./docker-manage.sh restart` to apply):

| Variable | Meaning |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root password — generate with `openssl rand -hex 24`, never by hand |
| `MYSQL_DATABASE` | Database name |
| `BETTER_AUTH_SECRET` | Session/auth signing key — generate with `openssl rand -hex 32` |
| `ORIGIN` | The full public address this instance is reached at, e.g. `https://assets.example.com` — used for cookies, redirects, and email links. Update this (and restart) if the address ever changes, e.g. after adding HTTPS |
| `APP_PORT` | Host port to publish (container always listens on 3000 internally) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Optional — outgoing mail for password resets etc. Left blank, emails just log to the container's console instead of sending |

## HTTPS

The container itself only ever speaks plain HTTP — put [Caddy](https://caddyserver.com/docs/install)
in front of it to terminate TLS. Which config depends on whether this server is reachable from
the public internet:

**Externally reachable (has a real domain, port 80/443 open to the internet):**

```
# /etc/caddy/Caddyfile
your-domain.com {
	reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy gets and renews a real, browser-trusted certificate automatically — nothing else to do.

**Internal-only (corporate network, no public DNS/internet reachability):**

Let's Encrypt can't reach a server like this, so point Caddy at its own private CA instead:

```
# /etc/caddy/Caddyfile
your-internal-hostname-or-ip {
	tls internal
	reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

This is real TLS, just not trusted by browsers yet — pull the CA cert off the server once and
trust it on whatever needs a clean padlock instead of a warning:

```bash
sudo cp /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt ~/caddy-root.crt
```

Windows: double-click it → *Install Certificate* → *Local Machine* → *Trusted Root Certification
Authorities*. macOS: open it in *Keychain Access*, set *Always Trust*. Linux:
`sudo cp caddy-root.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`. For
wide rollout to many domain-joined Windows PCs, push it via Group Policy (Computer Configuration →
Policies → Windows Settings → Security Settings → Public Key Policies → Trusted Root
Certification Authorities) instead of doing it machine-by-machine — note this covers Chrome/Edge
automatically but Firefox needs its own `EnterpriseRootCerts` policy enabled to read the same
store.

**Either way**, once it's live on HTTPS: update `ORIGIN` in `.env` to the real `https://` address
and `./docker-manage.sh restart` — and firewall off the raw `APP_PORT` from outside, so only
Caddy's 80/443 are reachable.

## Backups

The `mysql-data` and `uploads` named volumes hold everything that matters. Back up `mysql-data`
with a regular `mysqldump` (or a volume snapshot) and periodically copy out `uploads`.
