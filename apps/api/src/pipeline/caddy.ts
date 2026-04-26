import { appendLog } from "./logger.js";

const CADDY_ADMIN = process.env.CADDY_ADMIN_URL ?? "http://caddy:2019";

/**
 * Adds a reverse-proxy route to Caddy for the given deployment.
 *
 * Route: /deploy/<id>/* → strip prefix → container on hostPort
 *
 * We use the path `/deploy/:id` so every deployment gets its own
 * namespace on the single Caddy instance.
 */
export async function addCaddyRoute(
  deploymentId: string,
  containerName: string,
  containerPort: number
): Promise<string> {
  const routePath = `/deploy/${deploymentId}`;

  const route = {
    "@id": `deploy-${deploymentId}`,
    match: [{ path: [`${routePath}/*`, routePath] }],
    handle: [
      {
        handler: "subroute",
        routes: [
          {
            handle: [
              {
                handler: "rewrite",
                strip_path_prefix: routePath,
              },
            ],
          },
          {
            handle: [
              {
                handler: "reverse_proxy",
                // Caddy and the deployed container are on the same Docker
                // bridge network — dial by container name, no host port needed.
                upstreams: [{ dial: `${containerName}:${containerPort}` }],
              },
            ],
          },
        ],
      },
    ],
  };

  const res = await fetch(`${CADDY_ADMIN}/config/apps/http/servers/srv0/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(route),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Caddy admin API error (${res.status}): ${text}`);
  }

  await appendLog(deploymentId, "deploy", `Caddy route registered: ${routePath}`);
  return routePath;
}

/**
 * Remove a Caddy route by its @id tag.
 */
export async function removeCaddyRoute(deploymentId: string): Promise<void> {
  await fetch(`${CADDY_ADMIN}/id/deploy-${deploymentId}`, { method: "DELETE" });
}
