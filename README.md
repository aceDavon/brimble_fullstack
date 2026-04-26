# Brimble Deploy — Take-Home Submission

A one-page deployment pipeline. Submit a Git URL or a project archive; the system builds it into a container image with Railpack, runs it in Docker, registers a reverse-proxy route in Caddy, and streams build logs to the browser in real time via SSE.

## Quick start

```bash
git clone <this-repo>
cd brimble_fullStack
cp .env.example .env
docker compose up --build
```

Open `http://localhost`. No other setup required.

> **Prerequisites:** Docker with BuildKit support (Docker Desktop 4+ or Docker Engine 23+). Nothing else.

---

## Architecture

```
                 ┌──────────────────────────────────────────────────┐
                 │  Docker Compose (project: brimble)               │
                 │                                                  │
  Browser ──────▶│  Caddy :80                                       │
                 │    /api/*  → api:3000                            │
                 │    /deploy/:id/* → brimble-<id>:3000 (dynamic)  │
                 │    /*      → /srv/www (built frontend)           │
                 │            :2019 admin API (internal)            │
                 │                                                  │
                 │  API (Hono + Drizzle)  ─── Postgres :5432        │
                 │    mounts /var/run/docker.sock                   │
                 │    runs Railpack builds via BuildKit             │
                 │    starts app containers via Dockerode           │
                 │    registers Caddy routes via admin API          │
                 │                                                  │
                 │  BuildKit (moby/buildkit, privileged)            │
                 │    used by Railpack as the build backend         │
                 └──────────────────────────────────────────────────┘
```

All services share `brimble_brimble_net`. Deployed app containers are also attached to this network so Caddy can reach them by name without exposing host ports.

---

## How a deployment works

1. User submits a Git URL or uploads a `.tar.gz` / `.zip` archive.
2. API creates a `deployments` row with status `pending`, responds immediately (201), and kicks off the pipeline async.
3. **building** — source is cloned or extracted to a temp dir. Railpack builds it into an OCI image (`brimble-deploy-<short-id>:latest`) using the BuildKit daemon.  
   Every stdout/stderr line from Railpack is written to the `logs` table and emitted on an in-memory `EventEmitter` simultaneously.
4. **deploying** — Dockerode creates and starts a container on `brimble_brimble_net`. No host-port binding; Caddy dials it by container name.
5. Caddy admin API (`POST /config/apps/http/servers/srv0/routes`) receives a new route tagged `@id: deploy-<id>`. The route matches `/deploy/:id/*`, strips the path prefix, and proxies to `brimble-<short-id>:3000`.
6. **running** — record updated with `container_id`, `container_port` (always 3000), and `caddy_route_path`. Live URL shown in the UI.

Status transitions: `pending → building → deploying → running` (or `failed` at any step).

---

## Log streaming

`GET /api/deployments/:id/logs` returns `text/event-stream`.

On connect:
1. All persisted log rows for that deployment are replayed from Postgres as `data:` frames.
2. The handler subscribes to the per-deployment in-memory `EventEmitter`.
3. New log lines arrive as they are produced (during the build) — no buffering.
4. When the pipeline ends (either `running` or `failed`), the handler emits `event: done` and closes the stream.

The frontend uses `EventSource` — a native browser API for SSE. On reconnect or page refresh, step 1 replays all history so scroll-back works.

One caveat noted in the code: the `EventEmitter` is process-local. If the API restarts during a build, new SSE subscribers won't get live events for the in-progress build, but they will get everything persisted so far replayed from the database.

---

## API surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/deployments` | Create a deployment. Multipart: `source_type` (`git`\|`upload`), `url` or `file`, optional `name` |
| `GET` | `/api/deployments` | List all deployments, newest first |
| `GET` | `/api/deployments/:id` | Single deployment |
| `POST` | `/api/deployments/:id/redeploy` | Rebuild + restart from same source |
| `GET` | `/api/deployments/:id/logs` | SSE log stream |

---

## Project structure

```
brimble_fullStack/
├── apps/
│   ├── api/                     TypeScript, Hono, Drizzle
│   │   ├── src/
│   │   │   ├── db/              schema.ts, index.ts, migrate.ts
│   │   │   ├── routes/          deployments.ts, logs.ts
│   │   │   ├── pipeline/        index.ts, build.ts, run.ts, caddy.ts, logger.ts, extract.ts
│   │   │   ├── emitter.ts       per-deployment EventEmitter registry
│   │   │   └── index.ts         Hono app, migration-on-start
│   │   └── drizzle/             generated SQL migrations
│   └── frontend/                Vite, React, TanStack Router + Query
│       └── src/
│           ├── api/             typed fetch wrappers
│           ├── components/      DeploymentForm, DeploymentList, LogViewer
│           └── routes/          __root.tsx, index.tsx (single page)
├── caddy/
│   ├── Caddyfile                static config (admin :2019, frontend serve, /api proxy)
│   └── Dockerfile               multi-stage: builds frontend, bakes into caddy:2-alpine
├── sample-app/                  minimal Node.js HTTP server (Railpack-detectable)
└── docker-compose.yml
```

---

## Tech choices

**Hono** over Express/Fastify: native streaming support, first-class TypeScript, tiny runtime overhead. The SSE handler uses `ReadableStream` directly without any streaming library.

**Drizzle** over Prisma: generates plain SQL migrations, no query engine binary, straightforward type inference. The schema is the single source of truth — no separate type definitions.

**Dockerode** (Node.js Docker SDK) over shelling out to `docker` CLI: structured errors, no subprocess overhead, works over the mounted socket. Container lifecycle (create, start, stop, remove) is handled programmatically.

**Path-prefix routing** (`/deploy/:id`) over subdomains: works on `localhost` without DNS or `/etc/hosts` changes. Any reviewer can test it on a clean machine.

**Caddy admin API** for dynamic routing: zero-downtime config updates, JSON-native, no reload required. Routes are tagged with `@id` so they can be individually deleted on redeploy or teardown.

**BuildKit as a sidecar** (`moby/buildkit`, privileged): Railpack requires BuildKit. Running it as a compose service avoids privileged mode in the API container and keeps the build cache in a named volume across deploys — build cache reuse comes for free.

---

## Environment variables

All have sensible defaults in `docker-compose.yml`. Nothing external is required.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://brimble:brimble@db:5432/brimble` | Postgres connection string |
| `DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker socket path |
| `BUILDKIT_HOST` | `docker-container://buildkit` | BuildKit daemon address |
| `CADDY_ADMIN_URL` | `http://caddy:2019` | Caddy admin API base URL |
| `DOCKER_NETWORK` | `brimble_brimble_net` | Network deployed containers join |
| `PUBLIC_BASE_URL` | `http://localhost` | Used to construct live deployment URLs |
| `PORT` | `3000` | API listen port |

---

## Sample app

`sample-app/` is a minimal Node.js HTTP server with a `package.json` that declares `"engines": { "node": ">=18" }`. This is enough for Railpack to auto-detect the project type and build a runnable image without a Dockerfile.

To deploy it via the UI: either point to the repo URL, or `tar -czf sample.tar.gz -C sample-app .` and upload the resulting file.

---

## What I'd do with more time

- **Worker queue**: The pipeline currently runs in the API process. Under load, a crashed build leaves no retry mechanism. A proper queue (BullMQ or even Postgres-backed) would decouple build execution from the HTTP server and enable retries.
- **Graceful redeploy / zero-downtime swap**: The current redeploy stops the old container before starting the new one. The right approach is to start the new container first, wait for a health check to pass, update the Caddy upstream, then drain and stop the old one.
- **Build log TTL / pagination**: Logs accumulate in Postgres indefinitely. A cleanup job and cursor-based pagination on the SSE replay would be needed at any meaningful scale.
- **Container resource limits**: `docker.createContainer` accepts `HostConfig.Memory` and `CpuPeriod`. Without limits, a misbehaving deployed app can starve the host.
- **Structured Railpack errors**: Railpack exits non-zero on build failure but the error details are in the streamed log output, not a structured error. Parsing the last N lines to extract the failure reason would improve the error message shown in the UI.
- **What I'd rip out**: The `upload` path's use of `/app/uploads` as a volume-mounted temp dir is awkward in a multi-replica setup. I'd replace it with an object store (S3-compatible MinIO in compose for local dev).

---

## Rough time spent

| Phase | Time |
|---|---|
| Architecture planning + research | ~1.5 h |
| API (schema, pipeline, SSE, Caddy) | ~3.5 h |
| Frontend (TanStack wiring, components) | ~2 h |
| Docker / compose wiring + debugging | ~1.5 h |
| README | ~0.5 h |
| **Total** | **~9 h** |

---

## Brimble deploy + feedback

*[To be filled in after deploying to Brimble and writing up the experience.]*
