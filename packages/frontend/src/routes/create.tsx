import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/create")({
  component: () => <Navigate to="/policy" replace />,
});
