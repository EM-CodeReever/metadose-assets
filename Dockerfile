# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# SvelteKit's build-time route analysis actually imports the server module graph (to determine
# prerendering), which reaches src/lib/server/db/index.ts's startup check — it never opens a
# real connection at build time, just needs the var to be non-empty. The real DATABASE_URL is
# supplied at container runtime (docker-compose.yml), not baked into the image.
ENV DATABASE_URL=mysql://build:build@localhost:3306/build
ENV BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime
RUN npm run build

# ---

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# adapter-node's standalone server, plus everything the entrypoint's migration step and the
# db:seed-admin script need to run inside this image.
COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Default UPLOADS_DIR target — override via the UPLOADS_DIR env var and mount a volume at
# whatever path you point it to (see docker-compose.yml).
RUN addgroup -S app && adduser -S app -G app \
	&& mkdir -p /data/uploads \
	&& chown -R app:app /app /data/uploads
USER app

ENV PORT=3000 HOST=0.0.0.0 UPLOADS_DIR=/data/uploads
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
