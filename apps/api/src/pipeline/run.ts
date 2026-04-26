import Docker from "dockerode";
import net from "net";
import { appendLog } from "./logger.js";

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock" });

/**
 * Find an available host port in the ephemeral range.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "0.0.0.0", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/**
 * Start a container from the built image, attached to `brimble_net`.
 * Returns the container ID and the host port it is bound to.
 *
 * We expose port 3000 inside the container — Railpack's Node.js
 * build template starts the app on PORT=3000 by default.
 */
export async function startContainer(
  deploymentId: string,
  imageTag: string
): Promise<{ containerId: string; containerPort: number }> {
  const hostPort = await getFreePort();
  const containerInternalPort = 3000;

  await appendLog(deploymentId, "deploy", `Starting container from image ${imageTag} on host port ${hostPort}`);

  const container = await docker.createContainer({
    Image: imageTag,
    name: `brimble-${deploymentId.slice(0, 8)}`,
    Env: [`PORT=${containerInternalPort}`],
    ExposedPorts: { [`${containerInternalPort}/tcp`]: {} },
    HostConfig: {
      PortBindings: {
        [`${containerInternalPort}/tcp`]: [{ HostPort: String(hostPort) }],
      },
      NetworkMode: "brimble_fullstack_brimble_net",
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();

  await appendLog(deploymentId, "deploy", `Container ${container.id.slice(0, 12)} started`);

  return { containerId: container.id, containerPort: hostPort };
}

/**
 * Stop and remove a running container.
 */
export async function stopContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 5 });
    await container.remove();
  } catch (err: unknown) {
    // Container may already be gone — not fatal
    console.warn("stopContainer:", (err as Error).message);
  }
}
