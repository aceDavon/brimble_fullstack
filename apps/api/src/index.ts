import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { migrationDb, migrationClient } from "./db/index.js";
import deploymentsRoute from "./routes/deployments.js";
import logsRoute from "./routes/logs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run migrations on startup so the schema is always in sync
await migrate(migrationDb, { migrationsFolder: join(__dirname, "../drizzle") });
console.log("[db] migrations applied");
await migrationClient.end();

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.get("/healthz", (c) => c.json({ ok: true }));

app.route("/api/deployments", deploymentsRoute);
app.route("/api/deployments", logsRoute);

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`[api] listening on :${port}`);
});
