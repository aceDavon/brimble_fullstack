import { db } from "../db/index.js";
import { logs } from "../db/schema.js";
import { getEmitter } from "../emitter.js";
import type { Log } from "../db/schema.js";

export interface LogLine {
  phase: "build" | "deploy" | "system";
  message: string;
  ts: string;
}

/**
 * Persist a log line to Postgres and emit it on the in-memory
 * emitter so all active SSE connections receive it immediately.
 */
export async function appendLog(
  deploymentId: string,
  phase: LogLine["phase"],
  message: string
): Promise<void> {
  const ts = new Date();

  await db.insert(logs).values({ deploymentId, phase, message, ts });

  const emitter = getEmitter(deploymentId);
  emitter.emit("log", { phase, message, ts: ts.toISOString() } satisfies LogLine);
}

export async function getLogsForDeployment(deploymentId: string): Promise<Log[]> {
  return db.query.logs.findMany({
    where: (l, { eq }) => eq(l.deploymentId, deploymentId),
    orderBy: (l, { asc }) => [asc(l.ts), asc(l.id)],
  });
}
