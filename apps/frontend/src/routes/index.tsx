import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DeploymentForm } from "../components/DeploymentForm";
import { DeploymentList } from "../components/DeploymentList";
import { LogViewer } from "../components/LogViewer";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);

  function handleSelectLogs(id: string) {
    setSelectedDeploymentId((prev) => (prev === id ? null : id));
  }

  return (
    <>
      <DeploymentForm />
      <DeploymentList onSelectLogs={handleSelectLogs} selectedId={selectedDeploymentId} />
      {selectedDeploymentId && <LogViewer deploymentId={selectedDeploymentId} />}
    </>
  );
}
