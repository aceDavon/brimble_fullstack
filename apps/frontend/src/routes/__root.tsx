import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>Brimble Deploy</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
          Build and deploy containerised apps — powered by Railpack + Caddy
        </p>
      </header>
      <Outlet />
    </main>
  ),
});
