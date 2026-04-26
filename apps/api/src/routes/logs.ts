import { Hono } from "hono";
import { getEmitter } from "../emitter.js";
import { getLogsForDeployment } from "../pipeline/logger.js";
import { db } from "../db/index.js";
import type { LogLine } from "../pipeline/logger.js";

const logsRoute = new Hono();

/**
 * GET /api/deployments/:id/logs
 *
 * Server-Sent Events endpoint.
 *
 * On connect:
 *   1. Replays every persisted log line from Postgres (phase: build/deploy/system).
 *   2. Subscribes to the in-memory emitter for that deployment.
 *   3. Streams new lines as they arrive from the running pipeline.
 *   4. Sends a terminal `event: done` when the deployment reaches a
 *      terminal state (running or failed).
 */
logsRoute.get("/:id/logs", async (c) => {
  const id = c.req.param("id");

  // Verify the deployment exists before opening the stream
  const deployment = await db.query.deployments.findFirst({
    where: (d, { eq }) => eq(d.id, id),
  });
  if (!deployment) return c.json({ error: "Not found" }, 404);

  const emitter = getEmitter(id);

  const stream = new ReadableStream({
    start(controller) {
      const encode = (data: string) => new TextEncoder().encode(data);

      const sendLine = (line: LogLine) => {
        controller.enqueue(encode(`data: ${JSON.stringify(line)}\n\n`));
      };

      const sendDone = () => {
        controller.enqueue(encode(`event: done\ndata: {}\n\n`));
      };

      // 1. Replay historical logs from the database
      getLogsForDeployment(id).then((rows) => {
        for (const row of rows) {
          sendLine({ phase: row.phase as LogLine["phase"], message: row.message, ts: row.ts.toISOString() });
        }

        // 2. If already in a terminal state, close immediately after replay
        if (deployment.status === "running" || deployment.status === "failed") {
          sendDone();
          controller.close();
          return;
        }

        // 3. Subscribe to live events
        const onLog = (line: LogLine) => sendLine(line);
        const onDone = () => {
          sendDone();
          emitter.off("log", onLog);
          emitter.off("done", onDone);
          controller.close();
        };

        emitter.on("log", onLog);
        emitter.on("done", onDone);
      }).catch(() => {
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx/Caddy response buffering
    },
  });
});

export default logsRoute;
