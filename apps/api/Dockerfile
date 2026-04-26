FROM node:22-alpine AS base
WORKDIR /app

# Install Railpack binary
RUN apk add --no-cache curl bash git && \
    curl -fsSL https://railpack.io/install.sh | sh

# ─── dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# ─── build ───────────────────────────────────────────────────────────────────
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY tsconfig.json drizzle.config.json ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Keep git available for cloning repos submitted by users
RUN apk add --no-cache git

# Copy Railpack binary from base stage
COPY --from=base /usr/local/bin/railpack /usr/local/bin/railpack

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000
CMD ["node", "dist/index.js"]
