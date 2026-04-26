import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../db/index.js";
import { deployments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { appendLog } from "./logger.js";
import { buildImage } from "./build.js";
import { startContainer, stopContainer } from "./run.js";
import { addCaddyRoute, removeCaddyRoute } from "./caddy.js";
import { getEmitter } from "../emitter.js";
import { extract } from "./extract.js";

const execAsync = promisify(exec);

async function setStatus(
  id: string,
  status: string,
  extra?: Partial<typeof deployments.$inferInsert>
) {
  await db
    .update(deployments)
    .set({ status: status as typeof deployments.$inferSelect.status, updatedAt: new Date(), ...extra })
    .where(eq(deployments.id, id));
}

/**
 * Full deployment pipeline, run asynchronously after the POST /api/deployments responds.
 *
 * States traversed: pending → building → deploying → running (or failed at any step).
 */
export async function runPipeline(
  deploymentId: string,
  sourceType: "git" | "upload",
  sourceRef: string,        // git URL or uploaded filename
  uploadedFilePath?: string // absolute path to saved upload
): Promise<void> {
  const workDir = `/tmp/brimble-${deploymentId}`;

  try {
    // ── 1. Prepare source ─────────────────────────────────────────────────────
    await setStatus(deploymentId, "building");
    await mkdir(workDir, { recursive: true });

    if (sourceType === "git") {
      await appendLog(deploymentId, "build", `Cloning ${sourceRef}`);
      await execAsync(`git clone --depth=1 ${sourceRef} ${workDir}`);
      await appendLog(deploymentId, "build", "Clone complete");
    } else {
      if (!uploadedFilePath) throw new Error("uploadedFilePath missing for upload source");
      await appendLog(deploymentId, "build", `Extracting uploaded archive`);
      await extract(uploadedFilePath, workDir);
      await appendLog(deploymentId, "build", "Extraction complete");
    }

    // ── 2. Build image with Railpack ──────────────────────────────────────────
    const imageTag = `brimble-deploy-${deploymentId.slice(0, 8)}:latest`;
    await appendLog(deploymentId, "build", `Building image ${imageTag}`);
    await buildImage(deploymentId, workDir, imageTag);
    await appendLog(deploymentId, "build", `Image ${imageTag} built successfully`);
    await setStatus(deploymentId, "deploying", { imageTag });

    // ── 3. Stop previous container if redeploying ─────────────────────────────
    const current = await db.query.deployments.findFirst({
      where: (d, { eq }) => eq(d.id, deploymentId),
    });
    if (current?.containerId) {
      await appendLog(deploymentId, "deploy", "Stopping previous container");
      await stopContainer(current.containerId);
      if (current.caddyRoutePath) await removeCaddyRoute(deploymentId);
    }

    // ── 4. Start container ────────────────────────────────────────────────────
    const { containerId, containerName, containerPort } = await startContainer(deploymentId, imageTag);

    // ── 5. Register Caddy route ───────────────────────────────────────────────
    const caddyRoutePath = await addCaddyRoute(deploymentId, containerName, containerPort);

    // ── 6. Mark running ───────────────────────────────────────────────────────
    await setStatus(deploymentId, "running", { containerId, containerPort, caddyRoutePath });
    await appendLog(deploymentId, "system", `Deployment running at ${process.env.PUBLIC_BASE_URL}${caddyRoutePath}`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] deployment ${deploymentId} failed:`, message);
    await appendLog(deploymentId, "system", `Pipeline failed: ${message}`);
    await setStatus(deploymentId, "failed", { errorMessage: message });
  } finally {
    // Signal SSE subscribers the stream is over regardless of outcome
    getEmitter(deploymentId).emit("done");

    // Clean up source directory
    await rm(workDir, { recursive: true, force: true });
  }
}
