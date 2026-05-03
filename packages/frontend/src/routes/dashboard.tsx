import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  isAddress,
  parseAbi,
} from "viem";
import { useEffect, useState } from "react";
import {
  IWALLET_ABI,
  IWALLET_FACTORY_ABI,
  getBackendUrl,
  getFactoryAddress,
} from "#/lib/contracts";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const SALT =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

interface SessionListItem {
  sessionAddress: string;
  label: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface PolicyForm {
  dailyETH: string;
  allowedRecipients: string;
  tokensRaw: string;
  allowedSpenders: string;
  cooldownSeconds: string;
  expiresAtUnix: string;
}

interface OnChainPolicy {
  dailyETHLimit: bigint;
  allowedTokens: readonly `0x${string}`[];
  tokenDailyLimits: readonly bigint[];
  allowedContracts: readonly `0x${string}`[];
  allowedSpenders: readonly `0x${string}`[];
  cooldownSeconds: bigint;
  maxGasPerTx: bigint;
  expiresAt: bigint;
  active: boolean;
}

function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const factory = getFactoryAddress(chainId);
  const factoryReady = factory && factory !== "0x0";

  const { data: predicted } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: IWALLET_FACTORY_ABI,
    functionName: "computeAddress",
    args: address ? [address, SALT] : undefined,
    query: { enabled: !!factoryReady && !!address },
  });

  const iWalletAddr = predicted as `0x${string}` | undefined;

  const [hasCode, setHasCode] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!iWalletAddr || !publicClient) return;
      const code = await publicClient.getCode({ address: iWalletAddr });
      if (!cancelled) setHasCode(!!code && code !== "0x");
    })();
    return () => {
      cancelled = true;
    };
  }, [iWalletAddr, publicClient]);

  const { data: globalCap } = useReadContract({
    address: iWalletAddr,
    abi: IWALLET_ABI,
    functionName: "globalDailyETHLimit",
    query: { enabled: !!iWalletAddr && hasCode === true },
  });

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!iWalletAddr || hasCode !== true) return;
    fetch(`${getBackendUrl()}/api/wallet/sessions/${iWalletAddr}`)
      .then((r) => r.json())
      .then((j) => setSessions(j.sessions ?? []))
      .catch(() => setSessions([]));
  }, [iWalletAddr, hasCode, refreshKey]);

  if (!isConnected) {
    return (
      <main className="page-wrap mx-auto max-w-3xl px-4 py-12">
        <h1 className="display-title text-3xl font-bold">Dashboard</h1>
        <p className="mt-3">Connect your wallet to view your iWallet.</p>
        <div className="mt-4">
          <appkit-button />
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap mx-auto max-w-4xl px-4 py-12 space-y-6">
      <h1 className="display-title text-3xl font-bold">Dashboard</h1>

      <section className="island-shell rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-2">iWallet</h2>
        <p className="text-sm">
          Address:{" "}
          <code className="break-all">{iWalletAddr ?? "—"}</code>
        </p>
        <p className="text-sm mt-2">
          Status:{" "}
          {hasCode === null
            ? "checking…"
            : hasCode
              ? "Deployed"
              : "Not deployed yet"}
        </p>
        {hasCode === false && (
          <Link
            to="/connect"
            className="mt-3 inline-flex rounded-full bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white"
          >
            Deploy & provision a session
          </Link>
        )}
        {hasCode === true && (
          <p className="text-sm mt-2">
            Global ETH cap:{" "}
            {globalCap !== undefined
              ? `${formatEther(globalCap as bigint)} ETH/day`
              : "—"}
          </p>
        )}
      </section>

      <section className="island-shell rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <Link
            to="/connect"
            className="text-xs underline text-[var(--lagoon-deep)]"
          >
            + Provision new
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm opacity-70">
            No sessions yet.{" "}
            <Link
              to="/connect"
              className="underline text-[var(--lagoon-deep)]"
            >
              Provision one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <SessionRow
                key={s.sessionAddress}
                session={s}
                iWalletAddress={iWalletAddr}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SessionRow({
  session,
  iWalletAddress,
  onChanged,
}: {
  session: SessionListItem;
  iWalletAddress: `0x${string}` | undefined;
  onChanged: () => void;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [expanded, setExpanded] = useState(false);
  const [policy, setPolicy] = useState<OnChainPolicy | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number[]>([]);
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [busy, setBusy] = useState<"idle" | "saving" | "revoking">("idle");
  const [err, setErr] = useState<string | null>(null);

  // Lazy-load on expand
  useEffect(() => {
    if (!expanded || !iWalletAddress || !publicClient) return;
    if (policy) return;
    (async () => {
      try {
        const p = (await publicClient.readContract({
          address: iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "getSessionPolicy",
          args: [session.sessionAddress as `0x${string}`],
        })) as OnChainPolicy;
        setPolicy(p);
        const erc20Abi = parseAbi([
          "function decimals() view returns (uint8)",
        ]);
        const dec = await Promise.all(
          p.allowedTokens.map((t) =>
            publicClient
              .readContract({
                address: t,
                abi: erc20Abi,
                functionName: "decimals",
              })
              .then((d) => Number(d))
              .catch(() => 18)
          )
        );
        setTokenDecimals(dec);
        setForm({
          dailyETH: formatEther(p.dailyETHLimit),
          allowedRecipients: p.allowedContracts.join(", "),
          tokensRaw: p.allowedTokens
            .map((t, i) => {
              const d = dec[i] ?? 18;
              const human = formatUnits(p.tokenDailyLimits[i] ?? 0n, d);
              return d === 18 ? `${t},${human}` : `${t},${human},${d}`;
            })
            .join("\n"),
          allowedSpenders: p.allowedSpenders.join(", "),
          cooldownSeconds: p.cooldownSeconds.toString(),
          expiresAtUnix: p.expiresAt.toString(),
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [expanded, iWalletAddress, publicClient, session.sessionAddress, policy]);

  const handleSave = async () => {
    if (!iWalletAddress || !publicClient || !form) return;
    setBusy("saving");
    setErr(null);
    try {
      const recs = form.allowedRecipients
        .split(/[\s,]+/)
        .filter(Boolean);
      for (const r of recs) {
        if (!isAddress(r)) throw new Error(`bad recipient: ${r}`);
      }
      const spenders = form.allowedSpenders
        .split(/[\s,]+/)
        .filter(Boolean);
      for (const s of spenders) {
        if (!isAddress(s)) throw new Error(`bad spender: ${s}`);
      }
      const tokens: `0x${string}`[] = [];
      const caps: bigint[] = [];
      for (const line of form.tokensRaw.split(/\n+/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [a, c, dStr] = trimmed.split(/\s*,\s*/);
        if (!a || !isAddress(a)) throw new Error(`bad token: ${a}`);
        if (!c) throw new Error(`missing cap for ${a}`);
        const d = dStr ? Number(dStr) : 18;
        tokens.push(a as `0x${string}`);
        caps.push(parseUnits(c, d));
      }
      const next = {
        dailyETHLimit: parseEther(form.dailyETH),
        allowedTokens: tokens,
        tokenDailyLimits: caps,
        allowedContracts: recs as `0x${string}`[],
        allowedSpenders: spenders as `0x${string}`[],
        cooldownSeconds: BigInt(form.cooldownSeconds),
        maxGasPerTx: 0n,
        expiresAt: BigInt(form.expiresAtUnix),
        active: false,
      };
      const hash = await writeContractAsync({
        address: iWalletAddress,
        abi: IWALLET_ABI,
        functionName: "updateSessionPolicy",
        args: [session.sessionAddress as `0x${string}`, next],
        gas: 800_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      // Reload the policy
      setPolicy(null);
      setBusy("idle");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("idle");
    }
  };

  const handleRevoke = async () => {
    if (!iWalletAddress || !publicClient) return;
    if (!confirm(`Revoke session ${session.sessionAddress}? This is on-chain.`)) {
      return;
    }
    setBusy("revoking");
    setErr(null);
    try {
      const hash = await writeContractAsync({
        address: iWalletAddress,
        abi: IWALLET_ABI,
        functionName: "revokeSession",
        args: [session.sessionAddress as `0x${string}`],
        gas: 200_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      // Tell backend to revoke matching bearers so MCP stops accepting them
      await fetch(
        `${getBackendUrl()}/api/wallet/sessions/${iWalletAddress}/${session.sessionAddress}/revoke-bearers`,
        { method: "POST" }
      ).catch(() => {});
      setBusy("idle");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy("idle");
    }
  };

  return (
    <li className="rounded border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <code className="block break-all text-xs sm:text-sm">
            {session.sessionAddress}
          </code>
          <p className="opacity-70 text-xs mt-1">
            {session.label ?? "(unlabeled)"} · created{" "}
            {new Date(session.createdAt).toLocaleString()}
            {session.revokedAt ? " · REVOKED" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          {!session.revokedAt && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="underline text-[var(--lagoon-deep)]"
            >
              {expanded ? "Close" : "Edit policy"}
            </button>
          )}
          {!session.revokedAt && (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={busy !== "idle"}
              className="text-red-700 underline disabled:opacity-50"
            >
              {busy === "revoking" ? "Revoking…" : "Revoke"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          {!form ? (
            <p className="opacity-70 text-xs">Loading policy…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  Daily ETH cap
                  <input
                    value={form.dailyETH}
                    onChange={(e) =>
                      setForm({ ...form, dailyETH: e.target.value })
                    }
                    className="mt-1 w-full rounded border px-2 py-1"
                  />
                </label>
                <label className="text-xs">
                  Cooldown (sec)
                  <input
                    value={form.cooldownSeconds}
                    onChange={(e) =>
                      setForm({ ...form, cooldownSeconds: e.target.value })
                    }
                    className="mt-1 w-full rounded border px-2 py-1"
                  />
                </label>
                <label className="sm:col-span-2 text-xs">
                  Allowed recipients
                  <input
                    value={form.allowedRecipients}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allowedRecipients: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded border px-2 py-1"
                  />
                </label>
                <label className="sm:col-span-2 text-xs">
                  Tokens (one per line: address,cap[,decimals])
                  <textarea
                    value={form.tokensRaw}
                    onChange={(e) =>
                      setForm({ ...form, tokensRaw: e.target.value })
                    }
                    rows={3}
                    className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                  />
                </label>
                <label className="sm:col-span-2 text-xs">
                  Allowed approve spenders
                  <textarea
                    value={form.allowedSpenders}
                    onChange={(e) =>
                      setForm({ ...form, allowedSpenders: e.target.value })
                    }
                    rows={2}
                    className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                  />
                </label>
                <label className="sm:col-span-2 text-xs">
                  Expires at (unix, 0 = never)
                  <input
                    value={form.expiresAtUnix}
                    onChange={(e) =>
                      setForm({ ...form, expiresAtUnix: e.target.value })
                    }
                    className="mt-1 w-full rounded border px-2 py-1"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy !== "idle"}
                className="rounded-full bg-[var(--lagoon-deep)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy === "saving"
                  ? "Saving on-chain…"
                  : "Update policy"}
              </button>
              <p className="text-xs opacity-70">
                The bearer token is unchanged. Edit doesn't rotate the agent's
                MCP credential.
              </p>
            </>
          )}
          {err && (
            <p className="text-xs text-red-700 break-words">{err}</p>
          )}
        </div>
      )}
    </li>
  );
}
