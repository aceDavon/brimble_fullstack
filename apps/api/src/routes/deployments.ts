import { Hono } from "hono";
import { db } from "../db/index.js";
import { deployments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { runPipeline } from "../pipeline/index.js";

const deploymentsRoute = new Hono();

/** GET /api/deployments — list all, newest first */
deploymentsRoute.get("/", async (c) => {
  const rows = await db.query.deployments.findMany({
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
  return c.json(rows);
});

/** GET /api/deployments/:id — single record */
deploymentsRoute.get("/:id", async (c) => {
  const row = await db.query.deployments.findFirst({
    where: (d, { eq }) => eq(d.id, c.req.param("id")),
  });
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

/**
 * POST /api/deployments — create a deployment.
 *
 * Accepts multipart/form-data with:
 *   source_type = "git"    + url = <git clone url>
 *   source_type = "upload" + file = <tarball or zip>
 *   name = <optional display name>
 */
deploymentsRoute.post("/", async (c) => {
  const body = await c.req.parseBody();

  const sourceType = body["source_type"] as string;
  if (sourceType !== "git" && sourceType !== "upload") {
    return c.json({ error: "source_type must be 'git' or 'upload'" }, 400);
  }

  let sourceUrl: string | undefined;
  let uploadPath: string | undefined;

  if (sourceType === "git") {
    const url = body["url"] as string;
    if (!url) return c.json({ error: "url is required for git source" }, 400);
    sourceUrl = url;
  } else {
    const file = body["file"] as File | undefined;
    if (!file) return c.json({ error: "file is required for upload source" }, 400);

    const uploadDir = "/app/uploads";
    await mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}-${file.name}`;
    const dest = join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buffer);
    uploadPath = dest;
    sourceUrl = filename; // store filename as reference
  }

  const name = (body["name"] as string) || sourceUrl || "unnamed";

  const [deployment] = await db
    .insert(deployments)
    .values({ name, sourceType, sourceUrl })
    .returning();

  // kick off async — do not await
  runPipeline(deployment.id, sourceType, sourceUrl!, uploadPath).catch((err) => {
    console.error(`Pipeline error for ${deployment.id}:`, err);
  });

  return c.json(deployment, 201);
});

/**
 * POST /api/deployments/:id/redeploy — rebuild + restart from the same source
 */
deploymentsRoute.post("/:id/redeploy", async (c) => {
  const existing = await db.query.deployments.findFirst({
    where: (d, { eq }) => eq(d.id, c.req.param("id")),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  await db
    .update(deployments)
    .set({ status: "pending", imageTag: null, containerId: null, containerPort: null, errorMessage: null })
    .where(eq(deployments.id, existing.id));

  runPipeline(existing.id, existing.sourceType as "git" | "upload", existing.sourceUrl!, undefined).catch(
    (err) => console.error(`Redeploy error for ${existing.id}:`, err)
  );

  return c.json({ queued: true });
});

export default deploymentsRoute;
