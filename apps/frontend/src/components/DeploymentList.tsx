import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDeployments, redeployDeployment, type Deployment, type DeploymentStatus } from "../api/deployments";

interface Props {
  onSelectLogs: (id: string) => void;
  selectedId: string | null;
}

const STATUS_COLORS: Record<DeploymentStatus, string> = {
  pending:   "#6b7280",
  building:  "#d97706",
  deploying: "#2563eb",
  running:   "#16a34a",
  failed:    "#dc2626",
};

export function DeploymentList({ onSelectLogs, selectedId }: Props) {
  const queryClient = useQueryClient();

  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ["deployments"],
    queryFn: listDeployments,
    refetchInterval: (query) => {
      // Stop polling once all deployments are in a terminal state
      const rows = query.state.data ?? [];
      const allDone = rows.every((d) => d.status === "running" || d.status === "failed");
      return allDone ? false : 3_000;
    },
  });

  const redeploy = useMutation({
    mutationFn: (id: string) => redeployDeployment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deployments"] }),
  });

  if (isLoading) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (deployments.length === 0) return <p style={{ color: "#6b7280" }}>No deployments yet. Create one above.</p>;

  return (
    <section>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Deployments</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
            <th style={th}>Name</th>
            <th style={th}>Status</th>
            <th style={th}>Image tag</th>
            <th style={th}>Live URL</th>
            <th style={th}>Created</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((d) => (
            <DeploymentRow
              key={d.id}
              deployment={d}
              isSelected={d.id === selectedId}
              onViewLogs={() => onSelectLogs(d.id)}
              onRedeploy={() => redeploy.mutate(d.id)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DeploymentRow({
  deployment: d,
  isSelected,
  onViewLogs,
  onRedeploy,
}: {
  deployment: Deployment;
  isSelected: boolean;
  onViewLogs: () => void;
  onRedeploy: () => void;
}) {
  const liveUrl = d.caddyRoutePath ? `http://localhost${d.caddyRoutePath}` : null;
  const short = d.imageTag ? d.imageTag.split(":")[0].split("-").pop() ?? d.imageTag : "—";

  return (
    <tr
      style={{
        borderBottom: "1px solid #f3f4f6",
        background: isSelected ? "#f0f9ff" : "transparent",
      }}
    >
      <td style={td}>
        <span title={d.id} style={{ fontWeight: 500 }}>{d.name}</span>
        <br />
        <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>{d.id.slice(0, 8)}</span>
      </td>
      <td style={td}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: "0.75rem",
            fontWeight: 500,
            background: STATUS_COLORS[d.status] + "22",
            color: STATUS_COLORS[d.status],
          }}
        >
          {d.status}
        </span>
        {d.errorMessage && (
          <p style={{ color: "#dc2626", fontSize: "0.7rem", margin: "2px 0 0" }} title={d.errorMessage}>
            {d.errorMessage.slice(0, 60)}{d.errorMessage.length > 60 ? "…" : ""}
          </p>
        )}
      </td>
      <td style={{ ...td, fontFamily: "monospace", fontSize: "0.8rem" }}>
        {d.imageTag ? short : "—"}
      </td>
      <td style={td}>
        {liveUrl ? (
          <a href={liveUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
            {liveUrl}
          </a>
        ) : "—"}
      </td>
      <td style={{ ...td, color: "#6b7280", whiteSpace: "nowrap" }}>
        {new Date(d.createdAt).toLocaleString()}
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={onViewLogs} style={actionBtn}>
            {isSelected ? "Hide logs" : "Logs"}
          </button>
          {(d.status === "running" || d.status === "failed") && (
            <button onClick={onRedeploy} style={actionBtn}>
              Redeploy
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

const th: React.CSSProperties = { padding: "0.5rem 0.75rem", color: "#6b7280", fontWeight: 500 };
const td: React.CSSProperties = { padding: "0.6rem 0.75rem", verticalAlign: "top" };
const actionBtn: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: "0.78rem",
  background: "transparent",
  border: "1px solid #d1d5db",
  borderRadius: 5,
  cursor: "pointer",
};
