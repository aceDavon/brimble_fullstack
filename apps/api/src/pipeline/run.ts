import Docker from "dockerode";
import { appendLog } from "./logger.js";

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock" });

// The internal port Railpack Node.js apps listen on by default.
const CONTAINER_PORT = 3000;

// Docker Compose prefixes network names with the project name.
// COMPOSE_PROJECT_NAME defaults to the directory name, but we set it
// explicitly in docker-compose.yml so this is always predictable.
const DOCKER_NETWORK = process.env.DOCKER_NETWORK ?? "brimble_fullstack_brimble_net";

/**
 * Start a container from the built image joined to the shared bridge
 * network so Caddy can reach it by container name.
 *
 * Returns the container ID and the internal port (always 3000).
 * Caddy dials `<containerName>:3000` directly — no host-port binding needed.
 */
export async function startContainer(
  deploymentId: string,
  imageTag: string
): Promise<{ containerId: string; containerName: string; containerPort: number }> {
  const containerName = `brimble-${deploymentId.slice(0, 8)}`;

  await appendLog(deploymentId, "deploy", `Starting container ${containerName} from image ${imageTag}`);

  const container = await docker.createContainer({
    Image: imageTag,
    name: containerName,
    Env: [`PORT=${CONTAINER_PORT}`],
    ExposedPorts: { [`${CONTAINER_PORT}/tcp`]: {} },
    HostConfig: {
      NetworkMode: DOCKER_NETWORK,
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();

  await appendLog(deploymentId, "deploy", `Container ${container.id.slice(0, 12)} started on ${DOCKER_NETWORK}`);

  return { containerId: container.id, containerName, containerPort: CONTAINER_PORT };
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
