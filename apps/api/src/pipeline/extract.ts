import { createWriteStream, createReadStream } from "fs";
import { mkdir } from "fs/promises";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import * as tar from "tar";

/**
 * Extract a tar.gz or zip file into destDir.
 * We support .tar.gz / .tgz and .zip archives.
 */
export async function extract(archivePath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });

  const ext = archivePath.toLowerCase();

  if (ext.endsWith(".tar.gz") || ext.endsWith(".tgz")) {
    await tar.extract({ file: archivePath, cwd: destDir, strip: 1 });
    return;
  }

  if (ext.endsWith(".zip")) {
    // Dynamic import keeps the dep optional; the package is "unzipper"
    const unzipper = await import("unzipper");
    await pipeline(
      createReadStream(archivePath),
      unzipper.Extract({ path: destDir })
    );
    return;
  }

  throw new Error(
    `Unsupported archive format: ${archivePath}. Use .tar.gz, .tgz, or .zip`
  );
}
