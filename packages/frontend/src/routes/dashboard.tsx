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
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
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
          <appkit-button />
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
      ) : (
        <section className="island-shell rounded-2xl p-6">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[var(--lagoon-deep)]" />
            <h2 className="text-lg font-semibold">iWallet</h2>
          </div>
          <p className="text-sm">
            Address:{" "}
            <code className="break-all">{iWalletAddr ?? "—"}</code>
          </p>
          <p className="mt-2 text-sm">
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
        </section>
      )}

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

// ── Wallet balance + Withdraw All ─────────────────────────────────────

function useChainNativeSymbol(chainId: number | undefined): string {
  const { chain } = useAccount();
  if (chain?.nativeCurrency.symbol) return chain.nativeCurrency.symbol;
  // Defensive fallback when chain object isn't ready yet.
  if (chainId === 16602 || chainId === 16661) return "0G";
  return "ETH";
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
      className={`rounded-xl border p-4 transition hover:border-[var(--lagoon-deep)]/60 ${
        isNative ? "bg-[var(--lagoon-deep)]/5" : "bg-white/40"
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
