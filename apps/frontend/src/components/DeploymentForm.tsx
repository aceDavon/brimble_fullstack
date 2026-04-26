import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDeployment } from "../api/deployments";

export function DeploymentForm() {
  const [sourceType, setSourceType] = useState<"git" | "upload">("git");
  const [gitUrl, setGitUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: FormData) => createDeployment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      setGitUrl("");
      setFile(null);
      setName("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.append("source_type", sourceType);
    if (name.trim()) fd.append("name", name.trim());

    if (sourceType === "git") {
      if (!gitUrl.trim()) return setError("Git URL is required");
      fd.append("url", gitUrl.trim());
    } else {
      if (!file) return setError("Select a file to upload");
      fd.append("file", file);
    }

    mutation.mutate(fd);
  }

  return (
    <section style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem", marginBottom: "2rem" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>New Deployment</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="source_type"
              value="git"
              checked={sourceType === "git"}
              onChange={() => setSourceType("git")}
            />
            Git URL
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="source_type"
              value="upload"
              checked={sourceType === "upload"}
              onChange={() => setSourceType("upload")}
            />
            Upload archive
          </label>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />

          {sourceType === "git" ? (
            <input
              type="url"
              placeholder="https://github.com/user/repo"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              style={inputStyle}
            />
          ) : (
            <input
              type="file"
              accept=".tar.gz,.tgz,.zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={inputStyle}
            />
          )}

          {error && <p style={{ color: "#dc2626", margin: 0, fontSize: "0.875rem" }}>{error}</p>}

          <button
            type="submit"
            disabled={mutation.isPending}
            style={{ ...buttonStyle, opacity: mutation.isPending ? 0.6 : 1 }}
          >
            {mutation.isPending ? "Deploying…" : "Deploy"}
          </button>
        </div>
      </form>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.875rem",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.55rem 1.25rem",
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: "0.875rem",
  cursor: "pointer",
  width: "fit-content",
};
