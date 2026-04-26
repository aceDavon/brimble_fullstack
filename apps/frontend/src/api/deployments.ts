export type DeploymentStatus = "pending" | "building" | "deploying" | "running" | "failed";

export interface Deployment {
  id: string;
  name: string;
  sourceType: "git" | "upload";
  sourceUrl: string | null;
  status: DeploymentStatus;
  imageTag: string | null;
  containerId: string | null;
  containerPort: number | null;
  caddyRoutePath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api";

export async function listDeployments(): Promise<Deployment[]> {
  const res = await fetch(`${BASE}/deployments`);
  if (!res.ok) throw new Error(`Failed to list deployments: ${res.statusText}`);
  return res.json();
}

export async function getDeployment(id: string): Promise<Deployment> {
  const res = await fetch(`${BASE}/deployments/${id}`);
  if (!res.ok) throw new Error(`Deployment not found`);
  return res.json();
}

export async function createDeployment(data: FormData): Promise<Deployment> {
  const res = await fetch(`${BASE}/deployments`, {
    method: "POST",
    body: data,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to create deployment");
  }
  return res.json();
}

export async function redeployDeployment(id: string): Promise<void> {
  const res = await fetch(`${BASE}/deployments/${id}/redeploy`, { method: "POST" });
  if (!res.ok) throw new Error("Redeploy failed");
}
