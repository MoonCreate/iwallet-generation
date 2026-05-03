import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/configure")({
  component: () => <Navigate to="/connect" replace />,
});
