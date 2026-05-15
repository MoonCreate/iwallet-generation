import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignMessage,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import {
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  isAddress,
  parseAbi,
} from "viem";
import {
  IWALLET_ABI,
  IWALLET_FACTORY_ABI,
  getBackendUrl,
  getFactoryAddress,
  chainName,
} from "#/lib/contracts";
import { WalletButton } from "#/components/WalletButton";

export const Route = createFileRoute("/connect")({
  component: ConnectPage,
  validateSearch: (
    s: Record<string, unknown>
  ): { auth_id?: string } => ({
    auth_id: s.auth_id != null ? String(s.auth_id) : undefined,
  }),
});

const PROVISIONING_MESSAGE = "iWallet session bootstrap";
const SALT =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

const ERC20_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

// ── Form types ──────────────────────────────────────────────────

interface TokenRow {
  address: string;
  cap: string;          // human-readable amount
  decimals: number;
  symbol?: string;      // resolved on blur, display-only
  fetching?: boolean;
}

type ExpiryPreset = "never" | "1h" | "1d" | "1w" | "1m" | "custom";

interface PolicyForm {
  initialDeposit: string;       // in native currency, e.g. "1"
  dailyNative: string;          // session daily cap, native currency
  recipients: string[];
  tokens: TokenRow[];
  spenders: string[];
  cooldownSeconds: string;
  expiryPreset: ExpiryPreset;
  expiryCustomLocal: string;    // ISO string from <input type="datetime-local">
}

const defaultForm: PolicyForm = {
  initialDeposit: "1",
  dailyNative: "0.05",
  recipients: [],
  tokens: [],
  spenders: [],
  cooldownSeconds: "0",
  expiryPreset: "1w",
  expiryCustomLocal: "",
};

const EXPIRY_PRESETS: Array<{ value: ExpiryPreset; label: string }> = [
  { value: "never", label: "Never" },
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "1 day" },
  { value: "1w", label: "1 week" },
  { value: "1m", label: "1 month" },
  { value: "custom", label: "Custom date" },
];

function presetToUnix(form: PolicyForm): bigint {
  if (form.expiryPreset === "never") return 0n;
  if (form.expiryPreset === "custom") {
    if (!form.expiryCustomLocal) return 0n;
    const ms = new Date(form.expiryCustomLocal).getTime();
    return Number.isFinite(ms) ? BigInt(Math.floor(ms / 1000)) : 0n;
  }
  const now = Math.floor(Date.now() / 1000);
  const offset = {
    "1h": 3600,
    "1d": 86_400,
    "1w": 86_400 * 7,
    "1m": 86_400 * 30,
  }[form.expiryPreset];
  return BigInt(now + offset);
}

function unixToPreset(
  expiresAt: bigint
): { preset: ExpiryPreset; customLocal: string } {
  if (expiresAt === 0n) return { preset: "never", customLocal: "" };
  const ms = Number(expiresAt) * 1000;
  const isoLocal = new Date(ms - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  return { preset: "custom", customLocal: isoLocal };
}

// ── Component ───────────────────────────────────────────────────

function ConnectPage() {
  const { address, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const search = useSearch({ from: "/connect" });
  const isOAuth = !!search.auth_id;

  const factory = getFactoryAddress(chainId);
  const factoryReady = factory && factory !== "0x0";

  const nativeSymbol = chain?.nativeCurrency.symbol ?? "ETH";

  const [step, setStep] = useState<
    "idle" | "deploying" | "provisioning" | "registering" | "done" | "error"
  >("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(defaultForm);
  const [out, setOut] = useState<{
    iWalletAddress: `0x${string}`;
    sessionAddress: `0x${string}`;
    bearerToken: string;
  } | null>(null);
  // prefillState distinguishes three terminal states so the CTA can match:
  //   "no-wallet"  — no iWallet contract at the predicted address
  //   "no-session" — iWallet deployed but no active session on it
  //   "loaded"     — iWallet + active session, policy prefilled
  const [prefillState, setPrefillState] = useState<
    "idle" | "loading" | "loaded" | "no-wallet" | "no-session"
  >("idle");
  const [oauthReturnUri, setOauthReturnUri] = useState<string | null>(null);

  const { data: predicted } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: IWALLET_FACTORY_ABI,
    functionName: "computeAddress",
    args: address ? [address, SALT] : undefined,
    query: { enabled: !!factoryReady && !!address },
  });

  // ── Pre-fill from existing session ────────────────────────────
  useEffect(() => {
    if (!predicted || !publicClient) return;
    const iWalletAddress = predicted as `0x${string}`;
    let cancelled = false;

    let walletConfirmedExists = false;
    setPrefillState("loading");
    (async () => {
      try {
        const code = await publicClient.getCode({ address: iWalletAddress });
        if (!code || code === "0x") {
          if (!cancelled) setPrefillState("no-wallet");
          return;
        }
        walletConfirmedExists = true;
        // iWallet exists from here on — fall back to "no-session" instead of
        // "no-wallet" if any session lookup fails, so the CTA tells the user
        // their wallet is fine and only a session needs provisioning.
        const r = await fetch(
          `${getBackendUrl()}/api/wallet/sessions/${iWalletAddress}`
        );
        if (!r.ok) {
          if (!cancelled) setPrefillState("no-session");
          return;
        }
        const { sessions } = (await r.json()) as {
          sessions: Array<{
            sessionAddress: string;
            revokedAt: number | null;
          }>;
        };
        const session = sessions.find((s) => !s.revokedAt);
        if (!session) {
          if (!cancelled) setPrefillState("no-session");
          return;
        }
        const policy = (await publicClient.readContract({
          address: iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "getSessionPolicy",
          args: [session.sessionAddress as `0x${string}`],
        })) as {
          dailyETHLimit: bigint;
          allowedTokens: readonly `0x${string}`[];
          tokenDailyLimits: readonly bigint[];
          allowedContracts: readonly `0x${string}`[];
          allowedSpenders: readonly `0x${string}`[];
          cooldownSeconds: bigint;
          maxGasPerTx: bigint;
          expiresAt: bigint;
          active: boolean;
        };
        if (!policy.active) {
          if (!cancelled) setPrefillState("no-session");
          return;
        }
        const meta = await Promise.all(
          policy.allowedTokens.map(async (t) => {
            const [decimals, symbol] = await Promise.all([
              publicClient
                .readContract({
                  address: t,
                  abi: ERC20_ABI,
                  functionName: "decimals",
                })
                .then((d) => Number(d))
                .catch(() => 18),
              publicClient
                .readContract({
                  address: t,
                  abi: ERC20_ABI,
                  functionName: "symbol",
                })
                .catch(() => undefined),
            ]);
            return { decimals, symbol };
          })
        );
        const tokens: TokenRow[] = policy.allowedTokens.map((addr, i) => ({
          address: addr,
          cap: formatUnits(policy.tokenDailyLimits[i] ?? 0n, meta[i].decimals),
          decimals: meta[i].decimals,
          symbol: meta[i].symbol,
        }));
        const expiry = unixToPreset(policy.expiresAt);
        if (cancelled) return;
        setForm({
          initialDeposit: "0",
          dailyNative: formatEther(policy.dailyETHLimit),
          recipients: [...policy.allowedContracts],
          tokens,
          spenders: [...policy.allowedSpenders],
          cooldownSeconds: policy.cooldownSeconds.toString(),
          expiryPreset: expiry.preset,
          expiryCustomLocal: expiry.customLocal,
        });
        setPrefillState("loaded");
      } catch (e) {
        console.error("prefill failed:", e);
        // Pick the right fallback based on whether we made it past the
        // getCode check. Before getCode → can't tell if a wallet exists,
        // safer to assume no. After → we know it exists, just couldn't
        // load session/policy details.
        if (!cancelled) {
          setPrefillState(walletConfirmedExists ? "no-session" : "no-wallet");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally NOT depending on prefillState — gating on state combined
    // with React 18 strict-mode double-mount + the cancelled-flag pattern
    // creates a deadlock where no run ever lands a terminal state. The
    // cancelled flag alone is enough to discard stale results.
  }, [predicted, publicClient]);

  // ── Token row helpers ─────────────────────────────────────────

  async function fetchTokenMeta(rowIndex: number) {
    const row = form.tokens[rowIndex];
    if (!row || !publicClient) return;
    if (!isAddress(row.address)) return;
    setForm((f) => ({
      ...f,
      tokens: f.tokens.map((r, i) =>
        i === rowIndex ? { ...r, fetching: true } : r
      ),
    }));
    try {
      const [decimals, symbol] = await Promise.all([
        publicClient
          .readContract({
            address: row.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "decimals",
          })
          .then((d) => Number(d))
          .catch(() => 18),
        publicClient
          .readContract({
            address: row.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "symbol",
          })
          .catch(() => undefined),
      ]);
      setForm((f) => ({
        ...f,
        tokens: f.tokens.map((r, i) =>
          i === rowIndex
            ? { ...r, decimals, symbol, fetching: false }
            : r
        ),
      }));
    } catch {
      setForm((f) => ({
        ...f,
        tokens: f.tokens.map((r, i) =>
          i === rowIndex ? { ...r, fetching: false } : r
        ),
      }));
    }
  }

  // ── Submit ────────────────────────────────────────────────────

  const handleSetup = async () => {
    if (!address || !factory || !walletClient || !publicClient) return;
    setStep("deploying");
    setErrMsg(null);
    try {
      // Validate addresses up-front
      for (const r of form.recipients) {
        if (!isAddress(r))
          throw new Error(`Recipient is not a valid address: ${r}`);
      }
      for (const s of form.spenders) {
        if (!isAddress(s))
          throw new Error(`Spender is not a valid address: ${s}`);
      }
      for (const t of form.tokens) {
        if (!isAddress(t.address))
          throw new Error(`Token is not a valid address: ${t.address}`);
        if (!t.cap) throw new Error(`Missing cap for ${t.address}`);
      }

      const iWalletAddress = (await publicClient.readContract({
        address: factory,
        abi: IWALLET_FACTORY_ABI,
        functionName: "computeAddress",
        args: [address, SALT],
      })) as `0x${string}`;

      const code = await publicClient.getCode({ address: iWalletAddress });
      if (!code || code === "0x") {
        const deployHash = await writeContractAsync({
          address: factory,
          abi: IWALLET_FACTORY_ABI,
          functionName: "deploy",
          args: [address, SALT, parseEther("1"), [], []],
          gas: 3_000_000n,
        });
        try {
          await publicClient.waitForTransactionReceipt({
            hash: deployHash,
            // viem follows replacement txs (speedup/cancel) automatically
            // when this callback is set; without it some chains throw
            // "transaction has been replaced" even though a same-nonce tx
            // succeeded.
            onReplaced: ({ replacement, reason }) => {
              console.log(
                `[deploy] tx ${reason}, following replacement ${replacement.transactionHash}`
              );
            },
          });
        } catch (waitErr) {
          // Some 0G RPC nodes drop the tx hash from their pending pool right
          // after inclusion, so viem can't find the receipt and throws
          // TransactionReceiptNotFoundError or "transaction replaced".
          // The deterministic CREATE2 address gives us a reliable side check:
          // if there's code at the predicted address, the deploy worked.
          const after = await publicClient.getCode({ address: iWalletAddress });
          if (!after || after === "0x") {
            throw waitErr;
          }
          console.warn(
            "[deploy] receipt-wait failed but iWallet code present at predicted address — proceeding",
            waitErr
          );
        }
      }

      // Deposit
      const depositAmount = parseEther(form.initialDeposit || "0");
      if (depositAmount > 0n) {
        const currentBalance = await publicClient.getBalance({
          address: iWalletAddress,
        });
        if (currentBalance < depositAmount) {
          const depositHash = await walletClient.sendTransaction({
            to: iWalletAddress,
            value: depositAmount - currentBalance,
          });
          try {
            await publicClient.waitForTransactionReceipt({
              hash: depositHash,
              onReplaced: ({ replacement, reason }) => {
                console.log(
                  `[deposit] tx ${reason}, following ${replacement.transactionHash}`
                );
              },
            });
          } catch (waitErr) {
            // Verify by balance instead of receipt — same logic as deploy.
            const after = await publicClient.getBalance({
              address: iWalletAddress,
            });
            if (after < depositAmount) throw waitErr;
            console.warn(
              "[deposit] receipt-wait failed but iWallet balance reached target — proceeding",
              waitErr
            );
          }
        }
      }

      setStep("provisioning");
      const signature = await signMessageAsync({
        message: PROVISIONING_MESSAGE,
      });
      const provRes = await fetch(`${getBackendUrl()}/api/wallet/provision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signature,
          index: 0,
          iWalletAddress,
          chainId,
          label: "Agent session",
        }),
      });
      if (!provRes.ok)
        throw new Error(`Provision failed: ${provRes.status}`);
      const prov = (await provRes.json()) as {
        bearerToken: string;
        sessionAddress: `0x${string}`;
      };

      setStep("registering");
      const allowedTokens = form.tokens.map(
        (t) => t.address as `0x${string}`
      );
      const tokenDailyLimits = form.tokens.map((t) =>
        parseUnits(t.cap, t.decimals)
      );
      const policy = {
        dailyETHLimit: parseEther(form.dailyNative),
        allowedTokens,
        tokenDailyLimits,
        allowedContracts: form.recipients as `0x${string}`[],
        allowedSpenders: form.spenders as `0x${string}`[],
        cooldownSeconds: BigInt(form.cooldownSeconds),
        maxGasPerTx: 0n,
        expiresAt: presetToUnix(form),
        active: false,
      };
      const existing = (await publicClient.readContract({
        address: iWalletAddress,
        abi: IWALLET_ABI,
        functionName: "isSessionActive",
        args: [prov.sessionAddress],
      })) as boolean;
      const addHash = await writeContractAsync({
        address: iWalletAddress,
        abi: IWALLET_ABI,
        functionName: existing ? "updateSessionPolicy" : "addSession",
        args: [prov.sessionAddress, policy],
        gas: 800_000n,
      });
      try {
        await publicClient.waitForTransactionReceipt({
          hash: addHash,
          onReplaced: ({ replacement, reason }) => {
            console.log(
              `[addSession] tx ${reason}, following ${replacement.transactionHash}`
            );
          },
        });
      } catch (waitErr) {
        // Verify by reading isSessionActive instead of trusting the receipt.
        const isActive = (await publicClient.readContract({
          address: iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "isSessionActive",
          args: [prov.sessionAddress],
        })) as boolean;
        if (!isActive) throw waitErr;
        console.warn(
          "[addSession] receipt-wait failed but session is active on-chain — proceeding",
          waitErr
        );
      }

      setOut({
        iWalletAddress,
        sessionAddress: prov.sessionAddress,
        bearerToken: prov.bearerToken,
      });
      setStep("done");

      if (isOAuth && search.auth_id) {
        const completeRes = await fetch(
          `${getBackendUrl()}/oauth/authorize/complete`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              auth_id: search.auth_id,
              bearer_token: prov.bearerToken,
            }),
          }
        );
        if (!completeRes.ok)
          throw new Error(`OAuth complete failed: ${completeRes.status}`);
        const data = (await completeRes.json()) as { redirect_uri: string };
        // Don't auto-redirect — surface a "Return to MCP client" button so
        // the user actually gets to see the tutorials (and add this same
        // session to other clients) before bouncing back.
        setOauthReturnUri(data.redirect_uri);
      }
    } catch (e) {
      console.error(e);
      setErrMsg(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  // ── Computed ──────────────────────────────────────────────────

  const mcpUrl = `${getBackendUrl()}/mcp`;

  const expiryRel = useMemo(() => {
    const u = presetToUnix(form);
    if (u === 0n) return "Never expires";
    return `Expires ${new Date(Number(u) * 1000).toLocaleString()}`;
  }, [form]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <main className="page-wrap mx-auto max-w-3xl px-4 py-12">
      <h1 className="display-title mb-2 text-3xl font-bold">
        Connect an AI agent to your iWallet
      </h1>
      <p className="island-kicker mb-2">
        Sign once → get a session credential any MCP-speaking client (Claude,
        Cursor, custom bots) can use, capped by an on-chain policy you control.
      </p>
      {isOAuth && (
        <p className="mb-6 inline-block rounded-full bg-[var(--lagoon-deep)]/10 px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)]">
          OAuth handshake in progress — completing setup will send the token
          back to your MCP client.
        </p>
      )}

      {!isConnected && (
        <div className="island-shell rounded-2xl p-6">
          <p className="mb-2">Connect your wallet to continue.</p>
          <WalletButton />
        </div>
      )}

      {isConnected && !factoryReady && (
        <div className="island-shell rounded-2xl p-6 space-y-3">
          <p className="font-semibold">
            iWalletFactory isn't deployed on{" "}
            <strong>{chainName(chainId)}</strong> (chain {chainId}).
          </p>
          <p className="text-sm">
            Switch your wallet to <strong>0G Galileo Testnet</strong>:
          </p>
          <WalletButton />
        </div>
      )}

      {isConnected && factoryReady && step !== "done" && (
        <div className="island-shell rounded-2xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-semibold">
              Predicted iWallet address on {chainName(chainId)}
            </label>
            <code className="block rounded p-2 text-xs">
              {(predicted as string) ?? "—"}
            </code>
            {prefillState === "loading" && (
              <p className="text-xs opacity-70">Loading existing policy…</p>
            )}
            {prefillState === "loaded" && (
              <p className="text-xs text-[var(--lagoon-deep)]">
                Editing existing policy. Submitting will call{" "}
                <code>updateSessionPolicy</code>.
              </p>
            )}
            {prefillState === "no-wallet" && (
              <p className="text-xs opacity-70">
                No iWallet at this address yet — submitting will deploy it
                and add the first session.
              </p>
            )}
            {prefillState === "no-session" && (
              <p className="text-xs opacity-70">
                iWallet already deployed; no active session — submitting
                will provision a new session against your existing wallet.
              </p>
            )}
          </div>

          <Section title={`Initial deposit (${nativeSymbol})`}>
            <input
              value={form.initialDeposit}
              onChange={(e) =>
                setForm({ ...form, initialDeposit: e.target.value })
              }
              className="w-full rounded border px-3 py-2"
              placeholder="0"
            />
            <Help>
              {nativeSymbol} to send from your wallet to the iWallet at setup.
              Needed for the agent to spend native currency. Set 0 if already
              funded.
            </Help>
          </Section>

          <Section title="Daily caps">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="font-medium">
                  Daily {nativeSymbol} cap
                </span>
                <input
                  value={form.dailyNative}
                  onChange={(e) =>
                    setForm({ ...form, dailyNative: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>

              <div>
                <p className="text-sm font-medium mb-2">
                  ERC20 daily caps
                </p>
                {form.tokens.map((row, i) => (
                  <TokenInputRow
                    key={i}
                    row={row}
                    nativeSymbol={nativeSymbol}
                    onChange={(patch) =>
                      setForm((f) => ({
                        ...f,
                        tokens: f.tokens.map((r, j) =>
                          j === i ? { ...r, ...patch } : r
                        ),
                      }))
                    }
                    onResolve={() => fetchTokenMeta(i)}
                    onRemove={() =>
                      setForm((f) => ({
                        ...f,
                        tokens: f.tokens.filter((_, j) => j !== i),
                      }))
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      tokens: [
                        ...f.tokens,
                        { address: "", cap: "", decimals: 18 },
                      ],
                    }))
                  }
                  className="mt-1 rounded border border-dashed px-3 py-1.5 text-xs"
                >
                  + Add token
                </button>
                <Help>
                  Per-token daily limits. Decimals/symbol are auto-fetched from
                  the contract once you paste the address.
                </Help>
              </div>
            </div>
          </Section>

          <Section title="Allowed targets">
            <AddressList
              label={`Recipients of ${nativeSymbol} (empty = any address allowed within the daily cap)`}
              addresses={form.recipients}
              onChange={(recipients) => setForm({ ...form, recipients })}
              addLabel="+ Add recipient"
              placeholder="0x…"
            />
            <div className="h-4" />
            <AddressList
              label="Approve spenders (token approvals are blocked unless the spender is here; required for DEX routers, Permit2, etc.)"
              addresses={form.spenders}
              onChange={(spenders) => setForm({ ...form, spenders })}
              addLabel="+ Add spender"
              placeholder="0x…"
            />
          </Section>

          <Section title="Lifecycle">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">Cooldown (seconds)</span>
                <input
                  value={form.cooldownSeconds}
                  onChange={(e) =>
                    setForm({ ...form, cooldownSeconds: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <Help>
                  Minimum delay between transactions, applied per session.
                </Help>
              </label>
              <label className="text-sm">
                <span className="font-medium">Session expires</span>
                <select
                  value={form.expiryPreset}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      expiryPreset: e.target.value as ExpiryPreset,
                    })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  {EXPIRY_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {form.expiryPreset === "custom" && (
                  <input
                    type="datetime-local"
                    value={form.expiryCustomLocal}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        expiryCustomLocal: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded border px-3 py-2"
                  />
                )}
                <Help>{expiryRel}</Help>
              </label>
            </div>
          </Section>

          <button
            type="button"
            onClick={handleSetup}
            disabled={
              (step !== "idle" && step !== "error") ||
              prefillState === "idle" ||
              prefillState === "loading"
            }
            className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {step === "idle" || step === "error"
              ? prefillState === "loaded"
                ? "Update policy & rotate token"
                : prefillState === "no-session"
                  ? "Provision session"
                  : prefillState === "no-wallet"
                    ? "Deploy iWallet & provision session"
                    : "Checking iWallet status…"
              : step === "deploying"
                ? "Deploying iWallet…"
                : step === "provisioning"
                  ? "Signing & provisioning…"
                  : "Registering session on-chain…"}
          </button>

          {errMsg && (
            <p className="text-sm text-red-700 break-words whitespace-pre-line">
              {errMsg}
            </p>
          )}
        </div>
      )}

      {step === "done" && out && (
        <div className="island-shell rounded-2xl p-6 space-y-5">
          <h2 className="text-xl font-semibold">Session active</h2>

          {oauthReturnUri && (
            <div className="rounded-xl border border-[var(--lagoon-deep)]/40 bg-[var(--lagoon-deep)]/5 p-4 space-y-3">
              <p className="text-sm font-semibold">
                Your MCP client is waiting to receive the token.
              </p>
              <p className="text-xs opacity-70">
                Return now to hand the bearer back automatically — or stay on
                this page first to also add this iWallet to other clients
                (Cursor, Codex, VS Code…). The auth code below is single-use
                and will expire in a few minutes.
              </p>
              <a
                href={oauthReturnUri}
                className="inline-block rounded-full bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-semibold text-white"
              >
                Return to MCP client →
              </a>
            </div>
          )}

          <div className="space-y-1 text-xs">
            <div>
              <span className="font-medium">iWallet:</span>{" "}
              <code className="break-all">{out.iWalletAddress}</code>
            </div>
            <div>
              <span className="font-medium">Session:</span>{" "}
              <code className="break-all">{out.sessionAddress}</code>
            </div>
            <div>
              <span className="font-medium">Bearer:</span>{" "}
              <code className="break-all">{out.bearerToken}</code>
            </div>
          </div>

          <ClientTutorials
            mcpUrl={mcpUrl}
            bearerToken={out.bearerToken}
          />

          <p className="text-xs opacity-70">
            Don't forget: send a tiny amount of {nativeSymbol} to the session
            address (<code className="break-all">{out.sessionAddress}</code>)
            so it can pay gas to call{" "}
            <code>iWallet.execute()</code>.
          </p>
        </div>
      )}
    </main>
  );
}

// ── Subcomponents ───────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-xs opacity-60 mt-1">{children}</p>;
}

function TokenInputRow({
  row,
  nativeSymbol,
  onChange,
  onResolve,
  onRemove,
}: {
  row: TokenRow;
  nativeSymbol: string;
  onChange: (patch: Partial<TokenRow>) => void;
  onResolve: () => void;
  onRemove: () => void;
}) {
  const valid = isAddress(row.address);
  return (
    <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
      <input
        value={row.address}
        onChange={(e) => onChange({ address: e.target.value })}
        onBlur={() => valid && !row.symbol && onResolve()}
        placeholder="0x… token address"
        className="rounded border px-2 py-1.5 text-xs font-mono"
      />
      <input
        value={row.cap}
        onChange={(e) => onChange({ cap: e.target.value })}
        placeholder="cap"
        className="w-24 rounded border px-2 py-1.5 text-xs"
      />
      <span className="self-center text-xs opacity-70 min-w-[2.5rem]">
        {row.fetching
          ? "…"
          : row.symbol
            ? row.symbol
            : valid
              ? "?"
              : ""}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded border px-2 py-1 text-xs opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

function AddressList({
  label,
  addresses,
  onChange,
  addLabel,
  placeholder,
}: {
  label: string;
  addresses: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      {addresses.map((a, i) => (
        <div
          key={i}
          className="mb-2 grid grid-cols-[1fr_auto] gap-2"
        >
          <input
            value={a}
            onChange={(e) => {
              const next = [...addresses];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="rounded border px-2 py-1.5 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => onChange(addresses.filter((_, j) => j !== i))}
            className="rounded border px-2 py-1 text-xs opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...addresses, ""])}
        className="rounded border border-dashed px-3 py-1.5 text-xs"
      >
        {addLabel}
      </button>
    </div>
  );
}

// ── Per-client tutorials ────────────────────────────────────────

interface TutorialContent {
  key: string;
  label: string;
  oauthAvailable: boolean;
  oauthSnippet?: { lang: string; code: string };
  manualSnippet: { lang: string; code: string; configPath?: string };
  notes?: React.ReactNode;
}

function buildTutorials(
  mcpUrl: string,
  bearerToken: string
): TutorialContent[] {
  const bearer = `Authorization: Bearer ${bearerToken}`;

  const claudeCodeOAuth = `claude mcp add iwallet --transport http ${mcpUrl}`;
  const claudeCodeManual = `claude mcp add iwallet --transport http ${mcpUrl} \\
  --header "${bearer}"`;

  const claudeDesktopOAuth = JSON.stringify(
    {
      mcpServers: {
        iwallet: { type: "http", url: mcpUrl },
      },
    },
    null,
    2
  );
  const claudeDesktopManual = JSON.stringify(
    {
      mcpServers: {
        iwallet: {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      },
    },
    null,
    2
  );

  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        iwallet: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      },
    },
    null,
    2
  );

  const codexToml = `[mcp_servers.iwallet]
command = "npx"
args = [
  "-y",
  "mcp-remote",
  "${mcpUrl}",
  "--header",
  "${bearer}"
]
`;

  const vscodeJson = JSON.stringify(
    {
      servers: {
        iwallet: {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      },
    },
    null,
    2
  );

  const curlExample = `curl -i -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "${bearer}" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  return [
    {
      key: "claude-code",
      label: "Claude Code",
      oauthAvailable: true,
      oauthSnippet: { lang: "bash", code: claudeCodeOAuth },
      manualSnippet: { lang: "bash", code: claudeCodeManual },
      notes: (
        <>
          The OAuth version is preferred — first tool call returns 401, Claude
          Code prompts you, you confirm in the browser, token flows back
          automatically.
        </>
      ),
    },
    {
      key: "claude-desktop",
      label: "Claude Desktop",
      oauthAvailable: true,
      oauthSnippet: {
        lang: "json",
        code: claudeDesktopOAuth,
      },
      manualSnippet: {
        lang: "json",
        code: claudeDesktopManual,
        configPath:
          "~/Library/Application Support/Claude/claude_desktop_config.json (macOS) · %APPDATA%\\Claude\\claude_desktop_config.json (Windows)",
      },
      notes: (
        <>
          Edit <code>claude_desktop_config.json</code> and merge into the
          existing <code>mcpServers</code> object. Restart Claude Desktop.
        </>
      ),
    },
    {
      key: "cursor",
      label: "Cursor",
      oauthAvailable: false,
      manualSnippet: {
        lang: "json",
        code: cursorJson,
        configPath: ".cursor/mcp.json (project) · ~/.cursor/mcp.json (global)",
      },
      notes: (
        <>
          Cursor reads MCP servers from its config files. After saving, open
          the Composer or chat panel and the iwallet tools appear.
        </>
      ),
    },
    {
      key: "codex",
      label: "Codex CLI",
      oauthAvailable: false,
      manualSnippet: {
        lang: "toml",
        code: codexToml,
        configPath: "~/.codex/config.toml",
      },
      notes: (
        <>
          OpenAI Codex CLI uses stdio MCP transport. We bridge to the remote
          HTTP endpoint via the official <code>mcp-remote</code> shim — npx
          runs it on demand. No global install needed.
        </>
      ),
    },
    {
      key: "vscode",
      label: "VS Code Copilot",
      oauthAvailable: false,
      manualSnippet: {
        lang: "json",
        code: vscodeJson,
        configPath: ".vscode/mcp.json (project) · settings.json (global, under mcp.servers)",
      },
      notes: (
        <>
          Requires GitHub Copilot Chat with MCP enabled. The Copilot Chat side
          panel should list iwallet's tools after the file is saved.
        </>
      ),
    },
    {
      key: "curl",
      label: "Raw / curl",
      oauthAvailable: false,
      manualSnippet: { lang: "bash", code: curlExample },
      notes: (
        <>
          For testing or building your own MCP client. POST JSON-RPC 2.0 to
          the URL with the bearer header. <code>tools/list</code>,{" "}
          <code>tools/call</code>, <code>initialize</code> are the relevant
          methods.
        </>
      ),
    },
  ];
}

function ClientTutorials({
  mcpUrl,
  bearerToken,
}: {
  mcpUrl: string;
  bearerToken: string;
}) {
  const tutorials = useMemo(
    () => buildTutorials(mcpUrl, bearerToken),
    [mcpUrl, bearerToken]
  );
  const [active, setActive] = useState(tutorials[0]?.key ?? "");
  const [mode, setMode] = useState<"oauth" | "manual">("oauth");

  const current = tutorials.find((t) => t.key === active) ?? tutorials[0];
  const useOAuth = mode === "oauth" && current.oauthAvailable && current.oauthSnippet;
  const snippet = useOAuth ? current.oauthSnippet! : current.manualSnippet;

  return (
    <div>
      <p className="text-sm font-semibold mb-1">
        Plug into your MCP client
      </p>
      <p className="text-xs opacity-70 mb-3">
        iWallet exposes a streamable-HTTP MCP server with OAuth 2.1
        discovery. Pick your client below — clients that support OAuth can
        skip pasting the bearer.
      </p>

      <div className="flex flex-wrap gap-1 mb-2">
        {tutorials.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActive(t.key);
              if (!t.oauthAvailable) setMode("manual");
            }}
            className={`rounded-full px-3 py-1 text-xs ${
              active === t.key
                ? "bg-[var(--lagoon-deep)] text-white"
                : "border opacity-70 hover:opacity-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current.oauthAvailable && (
        <div className="flex gap-1 mb-2 text-xs">
          <button
            type="button"
            onClick={() => setMode("oauth")}
            className={`rounded px-2 py-0.5 ${
              mode === "oauth"
                ? "bg-[var(--lagoon-deep)]/20 text-[var(--lagoon-deep)] font-semibold"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            ✓ OAuth (preferred)
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded px-2 py-0.5 ${
              mode === "manual"
                ? "bg-[var(--lagoon-deep)]/20 text-[var(--lagoon-deep)] font-semibold"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            Bearer (manual)
          </button>
        </div>
      )}

      {snippet.configPath && (
        <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
          {snippet.configPath}
        </p>
      )}

      <CodeBlock lang={snippet.lang} code={snippet.code} />

      {current.notes && (
        <p className="text-xs opacity-70 mt-2">{current.notes}</p>
      )}
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded bg-black/10 p-3 text-xs whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2 top-2 rounded bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--lagoon-deep)] shadow"
        aria-label={`copy ${lang}`}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
