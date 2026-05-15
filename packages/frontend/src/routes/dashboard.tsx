import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  isAddress,
  parseAbi,
  multicall3Abi,
} from "viem";
import { useEffect, useMemo, useState } from "react";
import {
  IWALLET_ABI,
  IWALLET_FACTORY_ABI,
  getBackendUrl,
  getFactoryAddress,
} from "#/lib/contracts";
import {
  getSupportedTokens,
  isNativeToken,
  type SupportedToken,
} from "@iwallet/tokens";
import { WalletButton } from "#/components/WalletButton";
import {
  Activity,
  ArrowUpRight,
  Ban,
  Check,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";

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

  const nativeSymbol = useChainNativeSymbol(chainId);

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
          <WalletButton />
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap mx-auto max-w-4xl px-4 py-12 space-y-6">
      <h1 className="display-title text-3xl font-bold">Dashboard</h1>

      {hasCode === true && iWalletAddr && address ? (
        <WalletPanel
          iWalletAddress={iWalletAddr}
          masterAddress={address}
          nativeSymbol={nativeSymbol}
          chainId={chainId}
          globalCap={globalCap as bigint | undefined}
        />
      ) : hasCode === null ? (
        <section className="island-shell rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm opacity-70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking iWallet status…
          </div>
        </section>
      ) : (
        // Not-deployed empty state — centered, prominent CTA.
        <section className="island-shell rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lagoon-deep)]/10 text-[var(--lagoon-deep)]">
            <Wallet className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">No iWallet yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm opacity-70">
            Your iWallet will live at the deterministic address below once
            you deploy. The same address is reserved across redeploys, so
            this is what to fund / share.
          </p>
          {iWalletAddr && (
            <code className="mt-3 inline-block break-all rounded bg-black/10 px-2 py-1 font-mono text-xs">
              {iWalletAddr}
            </code>
          )}
          <div className="mt-6">
            <Link
              to="/policy"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ color: "white" }}
            >
              <ArrowUpRight className="h-4 w-4" />
              Deploy & provision a session
            </Link>
          </div>
        </section>
      )}

      <section className="island-shell rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[var(--lagoon-deep)]" />
            <h2 className="text-lg font-semibold">Sessions</h2>
            {sessions.length > 0 && (
              <span className="rounded-full bg-[var(--lagoon-deep)]/10 px-2 py-0.5 text-xs font-medium text-[var(--lagoon-deep)]">
                {sessions.filter((s) => !s.revokedAt).length} active
              </span>
            )}
          </div>
          <Link
            to="/policy"
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium opacity-80 transition hover:opacity-100"
          >
            + Provision new
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm opacity-70">
            No sessions yet.{" "}
            <Link
              to="/policy"
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
                chainId={chainId}
                nativeSymbol={nativeSymbol}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 0G Storage — Agent Memory */}
      {hasCode === true && iWalletAddr && (
        <ZgHistorySection iWalletAddress={iWalletAddr} />
      )}
    </main>
  );
}

interface TokenUsage {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  cap: bigint;
  spent: bigint;
}

function SessionRow({
  session,
  iWalletAddress,
  chainId,
  nativeSymbol,
  onChanged,
}: {
  session: SessionListItem;
  iWalletAddress: `0x${string}` | undefined;
  chainId: number;
  nativeSymbol: string;
  onChanged: () => void;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [expanded, setExpanded] = useState(false);
  const [policy, setPolicy] = useState<OnChainPolicy | null>(null);
  const [ethSpent, setEthSpent] = useState<bigint | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [tokenDecimals, setTokenDecimals] = useState<number[]>([]);
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [busy, setBusy] = useState<"idle" | "saving" | "revoking">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [reissueOpen, setReissueOpen] = useState(false);

  const explorer = explorerForChain(chainId);
  const supportedTokens = useMemo(() => getSupportedTokens(chainId), [chainId]);

  // Eager-load policy + daily-spent for the cap progress bars (single
  // multicall: getSessionPolicy + getSessionDailyEthSpent + per-token
  // getSessionDailyTokenSpent + per-token decimals/symbol).
  useEffect(() => {
    if (!iWalletAddress || !publicClient) return;
    // Skip the live read for revoked sessions — policy is irrelevant.
    if (session.revokedAt) return;
    let cancelled = false;
    (async () => {
      try {
        // Load policy first so we know how many tokens to pull next.
        const p = (await publicClient.readContract({
          address: iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "getSessionPolicy",
          args: [session.sessionAddress as `0x${string}`],
        })) as OnChainPolicy;
        if (cancelled) return;
        setPolicy(p);

        const erc20Abi = parseAbi([
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)",
        ]);

        // Build a single multicall for ETH spent + each token's spent +
        // decimals/symbol fallbacks for tokens not in the registry.
        const calls: Array<{
          address: `0x${string}`;
          abi: typeof IWALLET_ABI | typeof erc20Abi;
          functionName: string;
          args?: readonly unknown[];
        }> = [
          {
            address: iWalletAddress,
            abi: IWALLET_ABI,
            functionName: "getSessionDailyEthSpent",
            args: [session.sessionAddress as `0x${string}`],
          },
        ];

        const tokenInfo: Array<{
          address: `0x${string}`;
          symbol?: string;
          decimals?: number;
        }> = p.allowedTokens.map((t) => {
          const lower = t.toLowerCase();
          const hint = supportedTokens.find(
            (s) => s.address.toLowerCase() === lower
          );
          return {
            address: t,
            symbol: hint?.symbol,
            decimals: hint?.decimals,
          };
        });

        // Token spent reads (one per token).
        for (const t of p.allowedTokens) {
          calls.push({
            address: iWalletAddress,
            abi: IWALLET_ABI,
            functionName: "getSessionDailyTokenSpent",
            args: [session.sessionAddress as `0x${string}`, t],
          });
        }
        // For tokens missing decimals/symbol from the registry, read on-chain.
        for (let i = 0; i < tokenInfo.length; i++) {
          if (tokenInfo[i].decimals === undefined) {
            calls.push({
              address: tokenInfo[i].address,
              abi: erc20Abi,
              functionName: "decimals",
            });
          }
        }
        for (let i = 0; i < tokenInfo.length; i++) {
          if (tokenInfo[i].symbol === undefined) {
            calls.push({
              address: tokenInfo[i].address,
              abi: erc20Abi,
              functionName: "symbol",
            });
          }
        }

        const results = (await publicClient.multicall({
          contracts: calls as never,
          allowFailure: true,
        })) as Array<
          | { status: "success"; result: unknown }
          | { status: "failure"; error: unknown }
        >;
        if (cancelled) return;

        // Reconstruct positions.
        let cursor = 0;
        const ethR = results[cursor++];
        setEthSpent(ethR.status === "success" ? (ethR.result as bigint) : 0n);

        const tokenSpents: bigint[] = [];
        for (let i = 0; i < p.allowedTokens.length; i++) {
          const r = results[cursor++];
          tokenSpents.push(r.status === "success" ? (r.result as bigint) : 0n);
        }
        for (let i = 0; i < tokenInfo.length; i++) {
          if (tokenInfo[i].decimals === undefined) {
            const r = results[cursor++];
            tokenInfo[i].decimals =
              r.status === "success" ? Number(r.result as bigint | number) : 18;
          }
        }
        for (let i = 0; i < tokenInfo.length; i++) {
          if (tokenInfo[i].symbol === undefined) {
            const r = results[cursor++];
            tokenInfo[i].symbol =
              r.status === "success" ? String(r.result) : "?";
          }
        }

        const usage: TokenUsage[] = p.allowedTokens.map((addr, i) => ({
          address: addr,
          symbol: tokenInfo[i].symbol ?? "?",
          decimals: tokenInfo[i].decimals ?? 18,
          cap: p.tokenDailyLimits[i] ?? 0n,
          spent: tokenSpents[i] ?? 0n,
        }));
        setTokenUsage(usage);
        setTokenDecimals(usage.map((u) => u.decimals));
      } catch (e) {
        if (!cancelled) {
          console.error("session usage load failed:", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    iWalletAddress,
    publicClient,
    session.sessionAddress,
    session.revokedAt,
    supportedTokens,
  ]);

  // Build the editor form once we have policy + decimals (lazy on expand).
  useEffect(() => {
    if (!expanded || !policy || form) return;
    setForm({
      dailyETH: formatEther(policy.dailyETHLimit),
      allowedRecipients: policy.allowedContracts.join(", "),
      tokensRaw: policy.allowedTokens
        .map((t, i) => {
          const d = tokenDecimals[i] ?? 18;
          const human = formatUnits(policy.tokenDailyLimits[i] ?? 0n, d);
          return d === 18 ? `${t},${human}` : `${t},${human},${d}`;
        })
        .join("\n"),
      allowedSpenders: policy.allowedSpenders.join(", "),
      cooldownSeconds: policy.cooldownSeconds.toString(),
      expiresAtUnix: policy.expiresAt.toString(),
    });
  }, [expanded, policy, tokenDecimals, form]);

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

  // Status: revoked > expired (policy.expiresAt past) > active
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const isRevoked = !!session.revokedAt;
  const isExpired =
    !isRevoked &&
    !!policy &&
    policy.expiresAt > 0n &&
    nowSec > policy.expiresAt;
  const status: "active" | "revoked" | "expired" = isRevoked
    ? "revoked"
    : isExpired
      ? "expired"
      : "active";

  return (
    <li className="rounded-xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] p-4 transition hover:border-[var(--lagoon-deep)]/60">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="truncate font-mono text-xs sm:text-sm">
              {session.sessionAddress.slice(0, 14)}…
              {session.sessionAddress.slice(-6)}
            </code>
            <CopyAddress value={session.sessionAddress} />
            {explorer && (
              <a
                href={`${explorer}/address/${session.sessionAddress}`}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded p-1 opacity-60 transition hover:opacity-100"
                aria-label="Open on explorer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-xs opacity-70">
            {session.label ?? "(unlabeled)"} · created{" "}
            {new Date(session.createdAt).toLocaleString()}
            {session.revokedAt &&
              ` · revoked ${new Date(session.revokedAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
          {!isRevoked && (
            <button
              type="button"
              onClick={() => setReissueOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 opacity-80 transition hover:opacity-100"
              title="Get a fresh bearer to plug into a new MCP client"
            >
              <RotateCw className="h-3 w-3" />
              Reissue bearer
            </button>
          )}
          {!isRevoked && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 opacity-80 transition hover:opacity-100"
            >
              <Pencil className="h-3 w-3" />
              {expanded ? "Close" : "Edit"}
            </button>
          )}
          {!isRevoked && (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-1 rounded-full border border-red-400/40 px-2.5 py-1 text-red-700 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {busy === "revoking" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Revoking…
                </>
              ) : (
                <>
                  <Power className="h-3 w-3" />
                  Revoke
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Daily-cap progress bars */}
      {policy && !isRevoked && (
        <div className="mt-4 space-y-3">
          <CapBar
            label="ETH spend today"
            spent={ethSpent ?? 0n}
            cap={policy.dailyETHLimit}
            decimals={18}
            symbol={nativeSymbol}
          />
          {tokenUsage.map((u) => (
            <CapBar
              key={u.address}
              label={`${u.symbol} spend today`}
              spent={u.spent}
              cap={u.cap}
              decimals={u.decimals}
              symbol={u.symbol}
            />
          ))}
          {policy.cooldownSeconds > 0n && (
            <p className="flex items-center gap-1 text-xs opacity-70">
              <Clock className="h-3 w-3" />
              Cooldown: {policy.cooldownSeconds.toString()}s between txs
            </p>
          )}
          {policy.expiresAt > 0n && (
            <p className="flex items-center gap-1 text-xs opacity-70">
              <Clock className="h-3 w-3" />
              {isExpired ? "Expired" : "Expires"}{" "}
              {new Date(Number(policy.expiresAt) * 1000).toLocaleString()}
            </p>
          )}
        </div>
      )}

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
      {reissueOpen && iWalletAddress && (
        <ReissueBearerDialog
          iWalletAddress={iWalletAddress}
          chainId={chainId}
          label={session.label ?? "Agent session"}
          onClose={() => {
            setReissueOpen(false);
            onChanged();
          }}
        />
      )}
    </li>
  );
}

// ── Reissue bearer dialog ─────────────────────────────────────────────
// "Peeking" the original bearer is impossible — store/sessions.ts hashes
// bearers at rest. So instead we reissue: the master signs the standard
// provisioning message, the backend re-derives the same session privkey
// (deterministic from sig + index 0), generates a fresh bearer, and
// auto-revokes the previous one. The on-chain session is unchanged.

const PROVISIONING_MESSAGE = "iWallet session bootstrap";

function ReissueBearerDialog({
  iWalletAddress,
  chainId,
  label,
  onClose,
}: {
  iWalletAddress: `0x${string}`;
  chainId: number;
  label: string;
  onClose: () => void;
}) {
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState<"idle" | "signing" | "fetching" | "done" | "error">(
    "idle"
  );
  const [bearer, setBearer] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bearerCopied, setBearerCopied] = useState(false);
  const [cmdCopied, setCmdCopied] = useState(false);

  const backendUrl = getBackendUrl();
  const mcpUrl = `${backendUrl}/mcp`;

  async function reissue() {
    setErr(null);
    try {
      setStep("signing");
      const signature = await signMessageAsync({
        message: PROVISIONING_MESSAGE,
      });
      setStep("fetching");
      const r = await fetch(`${backendUrl}/api/wallet/provision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signature,
          index: 0,
          iWalletAddress,
          chainId,
          label,
        }),
      });
      if (!r.ok) throw new Error(`Provision failed: ${r.status}`);
      const j = (await r.json()) as { bearerToken: string };
      setBearer(j.bearerToken);
      setStep("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  }

  const mcpCommand = bearer
    ? `claude mcp add iwallet --transport http ${mcpUrl} --header "Authorization: Bearer ${bearer}"`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={step === "fetching" || step === "signing" ? undefined : onClose}
    >
      <div
        className="island-shell w-full max-w-lg rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-[var(--lagoon-deep)]" />
              <h3 className="text-lg font-semibold">Reissue bearer</h3>
            </div>
            <p className="text-xs opacity-70">
              The on-chain session stays the same. The previous bearer is
              auto-revoked when the new one is issued.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={step === "signing" || step === "fetching"}
            className="rounded-full p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100 disabled:opacity-30"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "idle" && (
          <>
            <p className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Reissuing rotates the bearer — any MCP client still using the
              old one will start failing immediately.
            </p>
            <button
              type="button"
              onClick={reissue}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ color: "white" }}
            >
              <RotateCw className="h-4 w-4" />
              Sign & reissue
            </button>
          </>
        )}

        {(step === "signing" || step === "fetching") && (
          <div className="flex items-center gap-2 rounded border p-3 text-sm opacity-80">
            <Loader2 className="h-4 w-4 animate-spin" />
            {step === "signing"
              ? "Sign the message in your wallet…"
              : "Provisioning new bearer…"}
          </div>
        )}

        {step === "done" && bearer && (
          <div className="space-y-3">
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
              <Check className="mr-1 inline h-3 w-3" />
              New bearer issued. The previous one is now revoked.
            </div>
            <label className="block">
              <span className="text-xs font-medium opacity-80">
                Bearer token
              </span>
              <div className="mt-1 flex items-stretch gap-2">
                <code className="flex-1 truncate rounded border bg-black/10 px-2 py-1.5 font-mono text-xs">
                  {bearer}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(bearer);
                    setBearerCopied(true);
                    setTimeout(() => setBearerCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs"
                >
                  {bearerCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium opacity-80">
                Add to Claude Code (one-line)
              </span>
              <div className="mt-1 flex items-stretch gap-2">
                <code className="flex-1 overflow-x-auto rounded border bg-black/10 px-2 py-1.5 font-mono text-xs whitespace-pre">
                  {mcpCommand}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(mcpCommand);
                    setCmdCopied(true);
                    setTimeout(() => setCmdCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs"
                >
                  {cmdCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs opacity-60">
                MCP server URL: <code>{mcpUrl}</code>
              </p>
            </label>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-full border px-4 py-2 text-sm opacity-80 hover:opacity-100"
            >
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <>
            <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 break-words">
              {err ?? "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setStep("idle");
              }}
              className="mt-3 w-full rounded-full border px-4 py-2 text-sm"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Wallet balance + Withdraw All ─────────────────────────────────────

function useChainNativeSymbol(chainId: number | undefined): string {
  const { chain } = useAccount();
  if (chain?.nativeCurrency.symbol) return chain.nativeCurrency.symbol;
  // Defensive fallback when chain object isn't ready yet.
  if (chainId === 16602 || chainId === 16661) return "0G";
  return "—";
}

function explorerForChain(chainId: number | undefined): string {
  if (chainId === 16602) return "https://chainscan-galileo.0g.ai";
  if (chainId === 16661) return "https://chainscan.0g.ai";
  return "";
}

function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard might be unavailable in some browser contexts */
        }
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs opacity-70 transition hover:bg-white/10 hover:opacity-100"
      aria-label="Copy address"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

interface TokenBalance {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  logo?: string;
  isNative: boolean;
}

function WalletPanel({
  iWalletAddress,
  masterAddress,
  nativeSymbol,
  chainId,
  globalCap,
}: {
  iWalletAddress: `0x${string}`;
  masterAddress: `0x${string}`;
  nativeSymbol: string;
  chainId: number;
  globalCap: bigint | undefined;
}) {
  const publicClient = usePublicClient();

  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const explorer = explorerForChain(chainId);

  // Supported tokens for this chain (native + ERC-20s like USDC/EURC).
  // Native is rendered through the same data path as ERC-20s — only the
  // balance-fetch differs (getBalance vs balanceOf).
  const supportedTokens = useMemo<SupportedToken[]>(
    () => getSupportedTokens(chainId),
    [chainId]
  );

  // Render the supported-tokens registry. (Custom-token entry was moved
  // out of the panel — adding ad-hoc tokens belongs in the registry now.)
  const allTokenAddrs = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ address: `0x${string}`; hint?: SupportedToken }> = [];
    for (const w of supportedTokens) {
      const key = w.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ address: w.address, hint: w });
    }
    return out;
  }, [supportedTokens]);

  // Refresh balances when token list or refreshKey changes. One Multicall3
  // round-trip for everything: getEthBalance for native + balanceOf + (when
  // the token isn't in the supported registry) decimals + symbol.
  useEffect(() => {
    if (!publicClient || allTokenAddrs.length === 0) {
      setTokens([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const erc20 = parseAbi([
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
      ]);

      // Build the multicall plan: each token contributes 1-3 calls. Track
      // which result indices belong to which token so we can stitch the
      // response back into TokenBalance objects below.
      type Plan = {
        tokenIdx: number;
        kind: "nativeBalance" | "balanceOf" | "decimals" | "symbol";
      };
      const calls: Array<{
        address: `0x${string}`;
        abi: typeof erc20 | typeof multicall3Abi;
        functionName: string;
        args?: readonly unknown[];
      }> = [];
      const plans: Plan[] = [];

      const multicall3Address =
        publicClient.chain?.contracts?.multicall3?.address;

      allTokenAddrs.forEach((entry, tokenIdx) => {
        const native = isNativeToken({ address: entry.address });
        if (native) {
          if (!multicall3Address) {
            // Multicall3 not configured for this chain — skip the native
            // call here; we'll fall back to getBalance after the multicall.
            return;
          }
          calls.push({
            address: multicall3Address,
            abi: multicall3Abi,
            functionName: "getEthBalance",
            args: [iWalletAddress],
          });
          plans.push({ tokenIdx, kind: "nativeBalance" });
          return;
        }
        // ERC-20: always read balanceOf; only read decimals/symbol when
        // we don't already have them from the supported-tokens hint.
        calls.push({
          address: entry.address,
          abi: erc20,
          functionName: "balanceOf",
          args: [iWalletAddress],
        });
        plans.push({ tokenIdx, kind: "balanceOf" });
        if (entry.hint?.decimals === undefined) {
          calls.push({
            address: entry.address,
            abi: erc20,
            functionName: "decimals",
          });
          plans.push({ tokenIdx, kind: "decimals" });
        }
        if (entry.hint?.symbol === undefined) {
          calls.push({
            address: entry.address,
            abi: erc20,
            functionName: "symbol",
          });
          plans.push({ tokenIdx, kind: "symbol" });
        }
      });

      // Buckets to collect per-token results.
      type Bucket = {
        balance?: bigint;
        decimals?: number;
        symbol?: string;
      };
      const buckets: Bucket[] = allTokenAddrs.map(() => ({}));

      let results: Array<
        { status: "success"; result: unknown } | { status: "failure"; error: unknown }
      > = [];
      try {
        results = (await publicClient.multicall({
          contracts: calls as never,
          allowFailure: true,
        })) as typeof results;
      } catch (e) {
        // If multicall itself blows up (wrong RPC, contract missing on a
        // forked chain, etc.) fall back to the per-call path on next render.
        console.warn("multicall failed, balances will be empty:", e);
      }

      results.forEach((r, i) => {
        if (r.status !== "success") return;
        const plan = plans[i];
        const bucket = buckets[plan.tokenIdx];
        switch (plan.kind) {
          case "nativeBalance":
          case "balanceOf":
            bucket.balance = r.result as bigint;
            break;
          case "decimals":
            bucket.decimals = Number(r.result as bigint | number);
            break;
          case "symbol":
            bucket.symbol = String(r.result);
            break;
        }
      });

      // Native fallback if multicall was unavailable for that chain.
      if (!multicall3Address) {
        for (let i = 0; i < allTokenAddrs.length; i++) {
          const entry = allTokenAddrs[i];
          if (
            isNativeToken({ address: entry.address }) &&
            buckets[i].balance === undefined
          ) {
            try {
              buckets[i].balance = await publicClient.getBalance({
                address: iWalletAddress,
              });
            } catch {
              buckets[i].balance = 0n;
            }
          }
        }
      }

      const out: TokenBalance[] = allTokenAddrs.map((entry, i) => {
        const bucket = buckets[i];
        const native = isNativeToken({ address: entry.address });
        return {
          address: entry.address,
          symbol:
            entry.hint?.symbol ??
            bucket.symbol ??
            (native ? nativeSymbol : "?"),
          name:
            entry.hint?.name ??
            (native ? `${nativeSymbol} (native)` : entry.address),
          decimals: entry.hint?.decimals ?? bucket.decimals ?? 18,
          balance: bucket.balance ?? 0n,
          logo: entry.hint?.logo,
          isNative: native,
        };
      });

      if (!cancelled) setTokens(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, iWalletAddress, allTokenAddrs, refreshKey, nativeSymbol]);

  const nothingToWithdraw = tokens.every((t) => t.balance === 0n);

  return (
    <>
      <section className="island-shell rounded-2xl p-6">
        {/* Header — title + address + actions */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[var(--lagoon-deep)]" />
              <h2 className="text-lg font-semibold">iWallet</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Deployed
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-1 text-xs opacity-80">
              <code className="truncate font-mono">{iWalletAddress}</code>
              <CopyAddress value={iWalletAddress} />
              {explorer && (
                <a
                  href={`${explorer}/address/${iWalletAddress}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 opacity-70 hover:bg-white/10 hover:opacity-100"
                  aria-label="Open on explorer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {globalCap !== undefined && (
              <p className="mt-2 text-xs opacity-70">
                Global cap:{" "}
                <span className="font-semibold">
                  {formatEther(globalCap)} {nativeSymbol}/day
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium opacity-80 transition hover:opacity-100"
              aria-label="Refresh balances"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setWithdrawOpen(true)}
              disabled={nothingToWithdraw}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lagoon-deep)] px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Withdraw
            </button>
          </div>
        </div>

        {/* Balances grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.length === 0 ? (
            <p className="col-span-full flex items-center gap-2 text-sm opacity-60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading balances…
            </p>
          ) : (
            tokens.map((t) => (
              <BalanceCard
                key={t.address}
                symbol={t.symbol}
                name={t.isNative ? t.name : t.address}
                amount={formatUnits(t.balance, t.decimals)}
                isNative={t.isNative}
                logo={t.logo}
                href={
                  t.isNative || !explorer
                    ? undefined
                    : `${explorer}/token/${t.address}`
                }
              />
            ))
          )}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-xs opacity-60">
          <KeyRound className="h-3 w-3" />
          Withdraw is <code>onlyOwner</code> — connect with{" "}
          {masterAddress.slice(0, 10)}…{masterAddress.slice(-4)} to use it.
        </p>
      </section>

      {withdrawOpen && (
        <WithdrawDialog
          iWalletAddress={iWalletAddress}
          masterAddress={masterAddress}
          tokens={tokens}
          onClose={() => {
            setWithdrawOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

// ── Withdraw Dialog ───────────────────────────────────────────────────

function WithdrawDialog({
  iWalletAddress,
  masterAddress,
  tokens,
  onClose,
}: {
  iWalletAddress: `0x${string}`;
  masterAddress: `0x${string}`;
  tokens: TokenBalance[];
  onClose: () => void;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [recipient, setRecipient] = useState<string>(masterAddress);
  // Per-asset selection — default to all non-zero ticked.
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      tokens.map((t) => [t.address.toLowerCase(), t.balance > 0n])
    )
  );
  const [withdrawing, setWithdrawing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const validRecipient = isAddress(recipient);
  const toWithdraw = tokens.filter(
    (t) => t.balance > 0n && selected[t.address.toLowerCase()]
  );

  async function execute() {
    if (!publicClient) return;
    if (!validRecipient) {
      setErr("Recipient is not a valid address");
      return;
    }
    if (toWithdraw.length === 0) {
      setErr("Select at least one asset to withdraw");
      return;
    }
    setErr(null);
    setLogs([]);
    setWithdrawing(true);
    const append = (line: string) =>
      setLogs((prev) => [...prev, line]);

    try {
      // Sort native first so we don't get caught short on gas after
      // draining a token first.
      const sorted = [...toWithdraw].sort(
        (a, b) => Number(b.isNative) - Number(a.isNative)
      );
      for (const t of sorted) {
        append(
          `Withdrawing ${formatUnits(t.balance, t.decimals)} ${t.symbol}…`
        );
        const hash = await writeContractAsync({
          address: iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "withdraw",
          args: [t.address, t.balance, recipient as `0x${string}`],
          gas: 200_000n,
        });
        try {
          await publicClient.waitForTransactionReceipt({
            hash,
            onReplaced: ({ replacement, reason }) =>
              append(`  tx ${reason} → ${replacement.transactionHash}`),
          });
        } catch (waitErr) {
          let after: bigint;
          if (t.isNative) {
            after = await publicClient.getBalance({
              address: iWalletAddress,
            });
          } else {
            const erc20 = parseAbi([
              "function balanceOf(address) view returns (uint256)",
            ]);
            after = (await publicClient.readContract({
              address: t.address,
              abi: erc20,
              functionName: "balanceOf",
              args: [iWalletAddress],
            })) as bigint;
          }
          if (after >= t.balance) throw waitErr;
        }
        append(`  ✓ ${hash}`);
      }
      append("Done.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={withdrawing ? undefined : onClose}
    >
      <div
        className="island-shell w-full max-w-md rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-[var(--lagoon-deep)]" />
              <h3 className="text-lg font-semibold">Withdraw assets</h3>
            </div>
            <p className="text-xs opacity-70">
              Drain selected assets out of your iWallet to a single recipient.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={withdrawing}
            className="rounded-full p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100 disabled:opacity-30"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-medium opacity-80">Send to</span>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={`mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs ${
              validRecipient ? "" : "border-red-500"
            }`}
            disabled={withdrawing}
          />
          {!validRecipient && (
            <span className="text-xs text-red-700">
              Not a valid address
            </span>
          )}
        </label>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium opacity-80">
            Assets to withdraw
          </p>
          <ul className="divide-y rounded border">
            {tokens.map((t) => {
              const key = t.address.toLowerCase();
              const isOn = !!selected[key];
              const zero = t.balance === 0n;
              return (
                <li
                  key={key}
                  className={`flex items-center gap-3 p-3 ${
                    zero ? "opacity-40" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={zero || withdrawing}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  {t.logo ? (
                    <img
                      src={t.logo}
                      alt={t.symbol}
                      className="h-7 w-7 rounded-full bg-white object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lagoon-deep)]/10 text-xs font-semibold text-[var(--lagoon-deep)]">
                      {t.symbol.slice(0, 3)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {t.symbol}
                    </p>
                    <p className="truncate text-xs opacity-60">
                      {t.isNative
                        ? "native"
                        : `${t.address.slice(0, 10)}…${t.address.slice(-4)}`}
                    </p>
                  </div>
                  <code className="text-sm tabular-nums">
                    {formatUnits(t.balance, t.decimals)}
                  </code>
                </li>
              );
            })}
          </ul>
        </div>

        {logs.length > 0 && (
          <pre className="mt-4 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-black/10 p-2 text-xs">
            {logs.join("\n")}
          </pre>
        )}
        {err && (
          <p className="mt-3 break-words text-xs text-red-700">{err}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={withdrawing}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-medium opacity-80 transition hover:opacity-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={execute}
            disabled={
              withdrawing || !validRecipient || toWithdraw.length === 0
            }
            className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {withdrawing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Withdrawing…
              </>
            ) : toWithdraw.length === 0 ? (
              "Nothing selected"
            ) : (
              <>
                <ArrowUpRight className="h-4 w-4" />
                Withdraw {toWithdraw.length}{" "}
                {toWithdraw.length === 1 ? "asset" : "assets"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({
  symbol,
  name,
  amount,
  isNative,
  logo,
  href,
}: {
  symbol: string;
  name: string;
  amount: string;
  isNative?: boolean;
  logo?: string;
  href?: string;
}) {
  // Compact display: trim long decimals so cards stay readable.
  const display = (() => {
    if (amount === "…") return "…";
    const n = Number(amount);
    if (!Number.isFinite(n)) return amount;
    if (n === 0) return "0";
    if (n < 0.0001) return n.toExponential(2);
    if (n < 1) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    if (n < 1000) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return n.toFixed(2);
  })();

  const Inner = (
    <div
      className={`rounded-xl border border-[var(--line)] p-4 transition hover:border-[var(--lagoon-deep)]/60 ${
        isNative
          ? "bg-[color-mix(in_oklab,var(--lagoon-deep)_8%,transparent)]"
          : "bg-[color-mix(in_oklab,var(--surface)_55%,transparent)]"
      }`}
    >
      <div className="flex items-center gap-3">
        {logo ? (
          <img
            src={logo}
            alt={symbol}
            className="h-10 w-10 rounded-full bg-white object-cover"
            loading="lazy"
            onError={(e) => {
              // Drop to the symbol-bubble fallback if the image 404s
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const next = (e.currentTarget as HTMLImageElement)
                .nextElementSibling as HTMLElement | null;
              if (next) next.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
            isNative
              ? "bg-[var(--lagoon-deep)] text-white"
              : "bg-[var(--lagoon-deep)]/10 text-[var(--lagoon-deep)]"
          }`}
          style={logo ? { display: "none" } : undefined}
        >
          {symbol.slice(0, 4)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{symbol}</p>
          <p className="truncate text-xs opacity-60">
            {name.startsWith("0x") ? `${name.slice(0, 10)}…${name.slice(-4)}` : name}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums">
        {display}{" "}
        <span className="text-xs font-normal opacity-70">{symbol}</span>
      </p>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="block"
      >
        {Inner}
      </a>
    );
  }
  return Inner;
}

// ── Session status pill ─────────────────────────────────────────────

function StatusPill({
  status,
}: {
  status: "active" | "revoked" | "expired";
}) {
  if (status === "revoked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
        <Ban className="h-3 w-3" />
        Revoked
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
      <Activity className="h-3 w-3" />
      Active
    </span>
  );
}

// ── Cap progress bar ────────────────────────────────────────────────
// Renders a labeled "spent / cap" line with a horizontal progress fill,
// color-coded by how close the session is to its limit. Handles cap=0
// (which the contract treats as "asset disabled") with a clear callout.

function CapBar({
  label,
  spent,
  cap,
  decimals,
  symbol,
}: {
  label: string;
  spent: bigint;
  cap: bigint;
  decimals: number;
  symbol: string;
}) {
  const capDisabled = cap === 0n;
  const pct = capDisabled ? 0 : Number((spent * 10000n) / cap) / 100; // 0–100 with 2 decimals
  const clamped = Math.min(100, Math.max(0, pct));
  const fillColor =
    clamped >= 100
      ? "bg-red-500"
      : clamped >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  const spentH = formatUnits(spent, decimals);
  const capH = capDisabled ? "—" : formatUnits(cap, decimals);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="opacity-80">{label}</span>
        <code className="tabular-nums opacity-90">
          {spentH}
          {!capDisabled && (
            <>
              {" / "}
              <span className="opacity-70">
                {capH} {symbol}
              </span>
            </>
          )}
          {capDisabled && (
            <span className="ml-1 text-[10px] opacity-60">
              ({symbol} disabled)
            </span>
          )}
        </code>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full ${fillColor} transition-all`}
          style={{ width: `${capDisabled ? 0 : clamped}%` }}
        />
      </div>
    </div>
  );
}

// ── 0G Storage History Section ──────────────────────────────────
interface ZgEntry {
  id: number;
  root_hash: string;
  summary: string | null;
  message_count: number;
  created_at: number;
}

function ZgHistorySection({ iWalletAddress }: { iWalletAddress: string }) {
  const [entries, setEntries] = useState<ZgEntry[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [messagesCache, setMessagesCache] = useState<Record<number, Array<{role: string; content: string}>>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/agent/history/${iWalletAddress}`)
      .then((r) => r.json())
      .then((j) => {
        setEnabled(j.enabled);
        setEntries(j.entries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [iWalletAddress]);

  async function toggleDetail(entry: ZgEntry) {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    if (messagesCache[entry.id]) return; // already cached
    setDetailLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/agent/history/${iWalletAddress}/${entry.root_hash}`);
      const data = await res.json();
      if (data.messages) {
        setMessagesCache((prev) => ({ ...prev, [entry.id]: data.messages }));
      }
    } catch {}
    setDetailLoading(false);
  }

  function continueInAgent(messages: Array<{role: string; content: string}>) {
    const chatId = crypto.randomUUID();
    const key = `iwallet-chats-${iWalletAddress.toLowerCase()}`;
    const chats = JSON.parse(localStorage.getItem(key) || "[]");
    const firstUser = messages.find((m) => m.role === "user");
    const entry = {
      id: chatId,
      title: firstUser?.content.slice(0, 60) || "Continued chat",
      messages,
      createdAt: Date.now(),
    };
    chats.unshift(entry);
    localStorage.setItem(key, JSON.stringify(chats.slice(0, 50)));
    // Set pending flag for agent page to pick up
    localStorage.setItem(`iwallet-continue-${iWalletAddress.toLowerCase()}`, JSON.stringify(entry));
    window.location.href = "/agent";
  }

  function stripThinking(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
  }

  return (
    <section className="island-shell rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-[var(--lagoon-deep)]" />
        <h2 className="text-lg font-semibold">Agent Memory</h2>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
          0G Storage
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history…
        </div>
      ) : !enabled ? (
        <p className="text-sm opacity-70">
          0G Storage not configured. Set <code>ZG_PRIVATE_KEY</code> in
          backend env to enable persistent agent memory on 0G decentralized
          storage.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm opacity-70">
          No conversations archived yet. Chat with your agent and
          conversations will be permanently stored on 0G Storage.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border overflow-hidden">
              <button
                onClick={() => toggleDetail(e)}
                className="w-full flex items-start gap-3 p-3 text-sm text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition group"
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0 opacity-50" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.message_count} messages</span>
                    <span className="opacity-50">·</span>
                    <span className="opacity-60">{new Date(e.created_at).toLocaleString()}</span>
                    <span className="ml-auto text-[10px] opacity-0 group-hover:opacity-60 transition text-emerald-500">
                      {expandedId === e.id ? "Click to collapse" : "Click to view"}
                    </span>
                  </div>
                  {e.summary && <p className="mt-0.5 truncate opacity-70">{e.summary}</p>}
                  <code className="mt-1 block truncate font-mono text-[10px] opacity-40">{e.root_hash}</code>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-30 group-hover:opacity-70 transition" />
              </button>

              {expandedId === e.id && (
                <div className="border-t p-3 space-y-3">
                  {detailLoading && !messagesCache[e.id] ? (
                    <div className="flex items-center gap-2 text-xs opacity-60">
                      <Loader2 className="h-3 w-3 animate-spin" /> Downloading from 0G Storage…
                    </div>
                  ) : messagesCache[e.id] ? (
                    <>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {messagesCache[e.id].map((m, i) => (
                          <div key={i} className={`rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-emerald-500/10 ml-8" : "bg-black/5 dark:bg-white/5 mr-8"}`}>
                            <span className="font-medium text-[10px] uppercase opacity-50">{m.role}</span>
                            <p className="mt-0.5 whitespace-pre-wrap">{stripThinking(m.content).slice(0, 500)}</p>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => continueInAgent(messagesCache[e.id])}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition cursor-pointer"
                      >
                        <ArrowUpRight className="h-3 w-3" /> Continue in Agent
                      </button>
                    </>
                  ) : (
                    <p className="text-xs opacity-60">Failed to load messages from 0G Storage.</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
