import { spawn } from "child_process";
import { appendLog } from "./logger.js";

/**
 * Runs `railpack build <srcDir> --name <imageTag>` against the
 * BuildKit daemon defined by BUILDKIT_HOST.
 *
 * Streams every stdout/stderr line to the log system so the UI
 * sees output as it is produced.
 *
 * Resolves with the image tag on success, rejects on non-zero exit.
 */
export async function buildImage(
  deploymentId: string,
  srcDir: string,
  imageTag: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BUILDKIT_HOST: process.env.BUILDKIT_HOST ?? "docker-container://buildkit",
    };

    const proc = spawn("railpack", ["build", srcDir, "--name", imageTag], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const handleLine = async (chunk: Buffer, phase: "build") => {
      const lines = chunk.toString("utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          await appendLog(deploymentId, phase, trimmed);
        }
      }
    };

    proc.stdout.on("data", (chunk: Buffer) => handleLine(chunk, "build"));
    proc.stderr.on("data", (chunk: Buffer) => handleLine(chunk, "build"));

    proc.on("error", (err) => {
      reject(new Error(`railpack spawn error: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(imageTag);
      } else {
        reject(new Error(`railpack exited with code ${code}`));
      }
    });
  });
}
