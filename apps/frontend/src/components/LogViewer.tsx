import { useEffect, useRef, useState } from "react";

interface LogLine {
  phase: "build" | "deploy" | "system";
  message: string;
  ts: string;
}

const PHASE_COLORS = {
  build:  "#2563eb",
  deploy: "#7c3aed",
  system: "#6b7280",
};

interface Props {
  deploymentId: string;
}

export function LogViewer({ deploymentId }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Close any previous connection when the selected deployment changes
    esRef.current?.close();
    setLines([]);
    setDone(false);
    setConnected(false);

    const es = new EventSource(`/api/deployments/${deploymentId}/logs`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data) as LogLine;
        setLines((prev) => [...prev, line]);
      } catch {
        // malformed frame — ignore
      }
    };

    es.addEventListener("done", () => {
      setDone(true);
      es.close();
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [deploymentId]);

  // Auto-scroll to the latest line
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <section style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          Build logs — <span style={{ fontFamily: "monospace", color: "#6b7280" }}>{deploymentId.slice(0, 8)}</span>
        </h2>
        <span
          style={{
            fontSize: "0.75rem",
            padding: "1px 8px",
            borderRadius: 999,
            background: done ? "#dcfce7" : connected ? "#fef9c3" : "#fee2e2",
            color: done ? "#16a34a" : connected ? "#a16207" : "#dc2626",
          }}
        >
          {done ? "complete" : connected ? "streaming" : "connecting…"}
        </span>
      </div>

      <pre
        style={{
          background: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 8,
          padding: "1rem",
          height: 400,
          overflowY: "auto",
          margin: 0,
          fontSize: "0.8rem",
          lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        {lines.length === 0 && !done && (
          <span style={{ color: "#475569" }}>Waiting for logs…</span>
        )}
        {lines.map((line, i) => (
          <div key={i}>
            <span style={{ color: "#475569", userSelect: "none" }}>
              {new Date(line.ts).toLocaleTimeString()} {" "}
            </span>
            <span style={{ color: PHASE_COLORS[line.phase], userSelect: "none" }}>
              [{line.phase}]{" "}
            </span>
            <span>{line.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </pre>
    </section>
  );
}
