# Stage 1 — build the frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY apps/frontend/package*.json ./
RUN npm ci
COPY apps/frontend/ .
RUN npm run build

# Stage 2 — Caddy with the built frontend baked in
FROM caddy:2-alpine
COPY --from=frontend-build /app/dist /srv/www
COPY caddy/Caddyfile /etc/caddy/Caddyfile
