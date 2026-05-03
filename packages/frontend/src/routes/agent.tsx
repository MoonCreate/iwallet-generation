import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/agent")({
  component: AgentPlaceholder,
});

function AgentPlaceholder() {
  return (
    <main className="page-wrap mx-auto max-w-2xl px-4 py-12">
      <h1 className="display-title mb-3 text-3xl font-bold">Agent demo</h1>
      <p className="island-kicker mb-6">
        The chat demo will be rewired against the new MCP tool surface
        soon.
      </p>
      <p className="text-sm">
        For now, plug iWallet into Claude Code or Claude Desktop via the
        remote MCP:{" "}
        <Link
          to="/connect"
          className="text-[var(--lagoon-deep)] underline"
        >
          /connect
        </Link>
      </p>
    </main>
  );
}
