FROM node:22-alpine AS base
WORKDIR /app

# Install Railpack binary from GitHub releases.
# Detect architecture so the same Dockerfile works on amd64 and arm64.
RUN apk add --no-cache curl tar bash git && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then RAILPACK_ARCH="x86_64"; else RAILPACK_ARCH="arm64"; fi && \
    RAILPACK_VERSION="v0.23.0" && \
    TARBALL="railpack-${RAILPACK_VERSION}-${RAILPACK_ARCH}-unknown-linux-musl.tar.gz" && \
    curl -fsSL "https://github.com/railwayapp/railpack/releases/download/${RAILPACK_VERSION}/${TARBALL}" \
      -o /tmp/railpack.tar.gz && \
    tar -xzf /tmp/railpack.tar.gz -C /tmp && \
    mv /tmp/railpack /usr/local/bin/railpack && \
    chmod +x /usr/local/bin/railpack && \
    rm /tmp/railpack.tar.gz

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
# Use Debian-slim (glibc) so that railpack's dynamically-downloaded mise binary
# (which is glibc-linked) can actually execute. Alpine's musl libc is not
# compatible with glibc ELFs regardless of gcompat/libc6-compat shims.
FROM node:22-slim AS runtime
WORKDIR /app

# Keep git available for cloning repos submitted by users.
# ca-certificates is required so railpack can download mise over TLS at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy Railpack binary from base stage
COPY --from=base /usr/local/bin/railpack /usr/local/bin/railpack

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000
CMD ["node", "dist/index.js"]
