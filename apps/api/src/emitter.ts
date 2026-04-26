import { EventEmitter } from "events";

/**
 * One emitter per deployment ID. Lives in process memory.
 * Listeners are the active SSE connections for that deployment.
 *
 * When the pipeline emits a log line, every open SSE connection
 * for that deployment ID receives it immediately.
 */
const emitters = new Map<string, EventEmitter>();

export function getEmitter(deploymentId: string): EventEmitter {
  let emitter = emitters.get(deploymentId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(50); // allow many concurrent viewers
    emitters.set(deploymentId, emitter);
  }
  return emitter;
}

export function removeEmitter(deploymentId: string): void {
  emitters.delete(deploymentId);
}
