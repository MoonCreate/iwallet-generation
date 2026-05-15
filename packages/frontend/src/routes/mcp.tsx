import { createFileRoute } from "@tanstack/react-router";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { useState, useEffect } from "react";
import { getBackendUrl, getFactoryAddress, IWALLET_FACTORY_ABI } from "#/lib/contracts";
import { Copy, Check, Plug } from "lucide-react";
import { WalletButton } from "#/components/WalletButton";

export const Route = createFileRoute("/mcp")({
  component: McpPage,
});

const SALT = "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

function McpPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const factory = getFactoryAddress(chainId);
  const { data: predicted } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: IWALLET_FACTORY_ABI,
    functionName: "computeAddress",
    args: address ? [address, SALT] : undefined,
    query: { enabled: !!factory && factory !== "0x0" && !!address },
  });
  const iWalletAddr = predicted as `0x${string}` | undefined;

  const [sessions, setSessions] = useState<Array<{ sessionAddress: string; label: string | null; revokedAt: number | null }>>([]);
  useEffect(() => {
    if (!iWalletAddr) return;
    fetch(`${getBackendUrl()}/api/wallet/sessions/${iWalletAddr}`)
      .then((r) => r.json())
      .then((j) => setSessions((j.sessions ?? []).filter((s: any) => !s.revokedAt)))
      .catch(() => {});
  }, [iWalletAddr]);

  const mcpUrl = `${getBackendUrl()}/mcp`;
  const hasSession = sessions.length > 0;

  if (!isConnected) {
    return (
      <main className="page-wrap mx-auto max-w-2xl px-4 py-12">
        <h1 className="display-title text-3xl font-bold mb-3">MCP Integration</h1>
        <p className="opacity-70">Connect your wallet to view MCP setup instructions.</p>
        <div className="mt-4"><WalletButton /></div>
      </main>
    );
  }

  return (
    <main className="page-wrap mx-auto max-w-2xl px-4 py-12 space-y-6">
      <div>
        <h1 className="display-title text-3xl font-bold mb-2">MCP Integration</h1>
        <p className="opacity-70 text-sm">
          Connect any MCP-compatible AI client to your iWallet. The agent operates within your on-chain policy rules.
        </p>
      </div>

      {/* Endpoint */}
      <section className="island-shell rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Plug className="h-4 w-4 text-[var(--lagoon-deep)]" /> MCP Endpoint
        </h2>
        <CopyBlock label="URL" value={mcpUrl} />
        {!hasSession && (
          <p className="text-xs text-amber-600">
            ⚠ No active session. Go to Policy page to provision one first.
          </p>
        )}
      </section>

      {/* Tutorials */}
      <section className="island-shell rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-semibold">Connect Your Client</h2>

        <div className="space-y-4">
          <Tutorial
            title="Claude Desktop"
            code={`// claude_desktop_config.json
{
  "mcpServers": {
    "iwallet": {
      "transport": "http",
      "url": "${mcpUrl}"
    }
  }
}`}
            note="Claude supports OAuth discovery — no bearer token needed. It will open a browser window to authorize."
          />

          <Tutorial
            title="Claude Code (CLI)"
            code={`claude mcp add iwallet --transport http ${mcpUrl}`}
            note="OAuth flow will open automatically in your browser."
          />

          <Tutorial
            title="Cursor / VS Code"
            code={`// .cursor/mcp.json or .vscode/mcp.json
{
  "servers": {
    "iwallet": {
      "transport": "http",
      "url": "${mcpUrl}"
    }
  }
}`}
            note="Supports OAuth discovery. Reissue a bearer from the Dashboard if manual auth is needed."
          />

          <Tutorial
            title="Manual (Bearer Token)"
            code={`curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <your-bearer-token>" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`}
            note="Get a bearer token by clicking 'Reissue bearer' on a session in the Dashboard."
          />
        </div>
      </section>

      {/* Available tools */}
      <section className="island-shell rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-semibold">Available Tools</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {["checkBalance", "sendETH", "sendToken", "approveToken", "executeRaw", "executeBatch", "getPolicy", "getDailySpent"].map((t) => (
            <code key={t} className="rounded border px-2 py-1 font-mono opacity-80">{t}</code>
          ))}
        </div>
        <p className="text-xs opacity-60">
          All tools are policy-enforced on-chain. The agent cannot exceed daily limits or call unauthorized contracts.
        </p>
      </section>
    </main>
  );
}

function Tutorial({ title, code, note }: { title: string; code: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="relative">
        <pre className="rounded bg-black/5 dark:bg-white/5 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{code}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="absolute top-2 right-2 rounded border bg-white dark:bg-black/50 p-1 opacity-60 hover:opacity-100"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <p className="text-xs opacity-60 mt-2">{note}</p>
    </div>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium opacity-70">{label}:</span>
      <code className="flex-1 truncate text-xs font-mono">{value}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 rounded border p-1 opacity-60 hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
