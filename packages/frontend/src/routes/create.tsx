import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/create")({
  component: () => <Navigate to="/connect" replace />,
});
