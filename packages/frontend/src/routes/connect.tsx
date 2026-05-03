import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "#/lib/contracts";

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

interface PolicyForm {
  initialDepositETH: string;
  dailyETH: string;
  allowedRecipients: string;
  /**
   * One token per line:
   *   <address>,<dailyCap>[,<decimals>]
   * decimals defaults to 18 if omitted.
   * Example:
   *   0xA0b8...eb48,100,6      # 100 USDC
   *   0x0165...Eb8F,100        # 100 TST (18 decimals)
   */
  tokensRaw: string;
  /** Comma- or newline-separated 0x addresses */
  allowedSpenders: string;
  cooldownSeconds: string;
  expiresAtUnix: string;
}

const defaultForm: PolicyForm = {
  initialDepositETH: "1",
  dailyETH: "0.05",
  allowedRecipients: "",
  tokensRaw: "",
  allowedSpenders: "",
  cooldownSeconds: "0",
  expiresAtUnix: "0",
};

function parseTokenLines(raw: string): {
  tokens: `0x${string}`[];
  caps: bigint[];
  errors: string[];
} {
  const tokens: `0x${string}`[] = [];
  const caps: bigint[] = [];
  const errors: string[] = [];
  for (const line of raw.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s*,\s*/);
    const [addr, capStr, decStr] = parts;
    if (!addr || !capStr) {
      errors.push(`bad row: "${trimmed}"`);
      continue;
    }
    if (!isAddress(addr)) {
      errors.push(`not a valid address: ${addr}`);
      continue;
    }
    const decimals = decStr ? Number(decStr) : 18;
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      errors.push(`bad decimals: ${decStr}`);
      continue;
    }
    try {
      caps.push(parseUnits(capStr, decimals));
      tokens.push(addr as `0x${string}`);
    } catch {
      errors.push(`bad amount: ${capStr}`);
    }
  }
  return { tokens, caps, errors };
}

function parseAddressList(raw: string): {
  addrs: `0x${string}`[];
  errors: string[];
} {
  const addrs: `0x${string}`[] = [];
  const errors: string[] = [];
  for (const t of raw.split(/[\s,]+/)) {
    const v = t.trim();
    if (!v) continue;
    if (!isAddress(v)) {
      errors.push(`not a valid address: ${v}`);
      continue;
    }
    addrs.push(v as `0x${string}`);
  }
  return { addrs, errors };
}

function ConnectPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const search = useSearch({ from: "/connect" });
  const isOAuth = !!search.auth_id;

  const factory = getFactoryAddress(chainId);
  const factoryReady = factory && factory !== "0x0";

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
  const [prefillState, setPrefillState] = useState<
    "idle" | "loading" | "loaded" | "no-existing"
  >("idle");

  const { data: predicted } = useReadContract({
    address: factory as `0x${string}` | undefined,
    abi: IWALLET_FACTORY_ABI,
    functionName: "computeAddress",
    args: address ? [address, SALT] : undefined,
    query: { enabled: !!factoryReady && !!address },
  });

  // Pre-fill form from existing on-chain policy (so revisiting /connect
  // is also "edit policy" UI).
  useEffect(() => {
    if (prefillState !== "idle") return;
    if (!predicted || !publicClient) return;
    const iWalletAddress = predicted as `0x${string}`;
    let cancelled = false;

    (async () => {
      setPrefillState("loading");
      try {
        // 1. Does the iWallet contract even exist yet?
        const code = await publicClient.getCode({ address: iWalletAddress });
        if (!code || code === "0x") {
          if (!cancelled) setPrefillState("no-existing");
          return;
        }
        // 2. Find a known session for this iWallet via backend (it remembers
        //    which session keys we've issued bearers for).
        const r = await fetch(
          `${getBackendUrl()}/api/wallet/sessions/${iWalletAddress}`
        );
        if (!r.ok) {
          if (!cancelled) setPrefillState("no-existing");
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
          if (!cancelled) setPrefillState("no-existing");
          return;
        }
        // 3. Read its policy on-chain.
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
          if (!cancelled) setPrefillState("no-existing");
          return;
        }
        // 4. Look up decimals for each allowed token (parallel).
        const erc20Abi = parseAbi([
          "function decimals() view returns (uint8)",
        ]);
        const decimals = await Promise.all(
          policy.allowedTokens.map((t) =>
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
        // 5. Format back into form fields.
        const tokensRaw = policy.allowedTokens
          .map((t, i) => {
            const dec = decimals[i] ?? 18;
            const human = formatUnits(policy.tokenDailyLimits[i] ?? 0n, dec);
            return dec === 18 ? `${t},${human}` : `${t},${human},${dec}`;
          })
          .join("\n");
        if (cancelled) return;
        setForm((prev) => ({
          ...prev,
          // keep depositETH as user-set (already-funded iWallet doesn't need
          // a refill by default)
          initialDepositETH: "0",
          dailyETH: formatEther(policy.dailyETHLimit),
          allowedRecipients: policy.allowedContracts.join(", "),
          tokensRaw,
          allowedSpenders: policy.allowedSpenders.join(", "),
          cooldownSeconds: policy.cooldownSeconds.toString(),
          expiresAtUnix: policy.expiresAt.toString(),
        }));
        setPrefillState("loaded");
      } catch (e) {
        console.error("prefill failed:", e);
        if (!cancelled) setPrefillState("no-existing");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [predicted, publicClient, prefillState]);

  const handleSetup = async () => {
    if (!address || !factory || !walletClient || !publicClient) return;
    setStep("deploying");
    setErrMsg(null);
    try {
      // Compute predicted iWallet address
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
        await publicClient.waitForTransactionReceipt({ hash: deployHash });
      }

      // Deposit ETH into the iWallet so it has funds to spend.
      const depositAmount = parseEther(form.initialDepositETH || "0");
      if (depositAmount > 0n) {
        const currentBalance = await publicClient.getBalance({
          address: iWalletAddress,
        });
        if (currentBalance < depositAmount) {
          const depositHash = await walletClient.sendTransaction({
            to: iWalletAddress,
            value: depositAmount - currentBalance,
          });
          await publicClient.waitForTransactionReceipt({ hash: depositHash });
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
          label: "Claude Code session",
        }),
      });
      if (!provRes.ok) throw new Error(`provision failed: ${provRes.status}`);
      const prov = (await provRes.json()) as {
        bearerToken: string;
        sessionAddress: `0x${string}`;
      };

      setStep("registering");
      const recParse = parseAddressList(form.allowedRecipients);
      const tokParse = parseTokenLines(form.tokensRaw);
      const spenParse = parseAddressList(form.allowedSpenders);
      const allErrs = [
        ...recParse.errors.map((e) => `recipients: ${e}`),
        ...tokParse.errors.map((e) => `tokens: ${e}`),
        ...spenParse.errors.map((e) => `spenders: ${e}`),
      ];
      if (allErrs.length > 0) {
        throw new Error(allErrs.join("\n"));
      }
      const policy = {
        dailyETHLimit: parseEther(form.dailyETH),
        allowedTokens: tokParse.tokens,
        tokenDailyLimits: tokParse.caps,
        allowedContracts: recParse.addrs,
        allowedSpenders: spenParse.addrs,
        cooldownSeconds: BigInt(form.cooldownSeconds),
        maxGasPerTx: 0n,
        expiresAt: BigInt(form.expiresAtUnix),
        active: false,
      };
      // If this session is already registered, update its policy instead
      // of trying to add it again (addSession reverts on existing).
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
        gas: 500_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: addHash });

      setOut({
        iWalletAddress,
        sessionAddress: prov.sessionAddress,
        bearerToken: prov.bearerToken,
      });
      setStep("done");

      // If we got here as part of an OAuth flow (Claude Code redirected
      // here with ?oauth=1&auth_id=...), complete the handoff: send the
      // bearer to the backend, get an auth_code-bearing redirect URL,
      // then bounce the user-agent there.
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
        if (!completeRes.ok) {
          throw new Error(`OAuth complete failed: ${completeRes.status}`);
        }
        const data = (await completeRes.json()) as { redirect_uri: string };
        // Hand control back to the MCP client
        window.location.href = data.redirect_uri;
      }
    } catch (e) {
      console.error(e);
      setErrMsg(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const mcpAddCommand = out
    ? `claude mcp add iwallet ${getBackendUrl()}/mcp --transport http --header "Authorization: Bearer ${out.bearerToken}"`
    : "";

  return (
    <main className="page-wrap mx-auto max-w-3xl px-4 py-12">
      <h1 className="display-title mb-2 text-3xl font-bold">
        Connect Claude Code to your iWallet
      </h1>
      <p className="island-kicker mb-2">
        Sign a message → get a scoped session your AI agent can use, bounded
        by an on-chain policy you control.
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
          <appkit-button />
        </div>
      )}

      {isConnected && !factoryReady && (
        <div className="island-shell rounded-2xl p-6 space-y-3">
          <p className="font-semibold">
            iWalletFactory isn't deployed on the chain your wallet is on
            (chainId <code>{chainId ?? "?"}</code>).
          </p>
          <p className="text-sm">
            For this local demo, switch to the <strong>Hardhat</strong>{" "}
            network (chainId <code>31337</code>, RPC{" "}
            <code>http://127.0.0.1:8545</code>). You can pick it from your
            wallet directly:
          </p>
          <appkit-network-button />
          <p className="text-xs opacity-70">
            If your wallet doesn't list Hardhat yet, add it manually with
            chainId 31337, RPC <code>http://127.0.0.1:8545</code>, currency
            ETH. Then import a funded account using one of the private keys
            printed by <code>hardhat node</code> (e.g. account #0).
          </p>
        </div>
      )}

      {isConnected && factoryReady && step !== "done" && (
        <div className="island-shell rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold">
              Predicted iWallet address
            </label>
            <code className="block rounded bg-black/10 p-2 text-xs">
              {(predicted as string) ?? "—"}
            </code>
            {prefillState === "loading" && (
              <p className="text-xs opacity-70">Loading existing policy…</p>
            )}
            {prefillState === "loaded" && (
              <p className="text-xs text-[var(--lagoon-deep)]">
                Editing existing policy (all fields pre-filled). Submit to
                update on-chain via <code>updateSessionPolicy</code>.
              </p>
            )}
            {prefillState === "no-existing" && (
              <p className="text-xs opacity-70">
                No existing iWallet/session — submitting will deploy + add a
                fresh session.
              </p>
            )}
          </div>

          <h2 className="text-lg font-semibold pt-2">Initial deposit</h2>
          <label className="block text-sm">
            ETH to deposit into iWallet (the wallet has 0 ETH until you fund it)
            <input
              value={form.initialDepositETH}
              onChange={(e) =>
                setForm({ ...form, initialDepositETH: e.target.value })
              }
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>

          <h2 className="text-lg font-semibold pt-2">Session policy</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Daily ETH cap (per session)
              <input
                value={form.dailyETH}
                onChange={(e) =>
                  setForm({ ...form, dailyETH: e.target.value })
                }
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="text-sm">
              Cooldown (seconds)
              <input
                value={form.cooldownSeconds}
                onChange={(e) =>
                  setForm({ ...form, cooldownSeconds: e.target.value })
                }
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              Allowed recipients (comma-separated 0x addresses; empty = any
              address allowed within ETH cap)
              <input
                value={form.allowedRecipients}
                onChange={(e) =>
                  setForm({ ...form, allowedRecipients: e.target.value })
                }
                placeholder="0x… , 0x…"
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              Allowed tokens & per-token daily caps — one per line, format{" "}
              <code className="text-xs">address,humanAmount[,decimals]</code>{" "}
              (decimals defaults to 18)
              <textarea
                value={form.tokensRaw}
                onChange={(e) =>
                  setForm({ ...form, tokensRaw: e.target.value })
                }
                rows={3}
                placeholder={
                  "0x0165878A594ca255338adfa4d48449f69242Eb8F,100\n0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,50,6"
                }
                className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              Allowed approve spenders (comma- or newline-separated 0x
              addresses; empty = approvals disallowed)
              <textarea
                value={form.allowedSpenders}
                onChange={(e) =>
                  setForm({ ...form, allowedSpenders: e.target.value })
                }
                rows={2}
                placeholder="0x… , 0x…"
                className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              Expires at (unix seconds, 0 = never)
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
            onClick={handleSetup}
            disabled={step !== "idle" && step !== "error"}
            className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {step === "idle" || step === "error"
              ? "Provision session"
              : step === "deploying"
                ? "Deploying iWallet…"
                : step === "provisioning"
                  ? "Signing & provisioning…"
                  : "Registering session…"}
          </button>

          {errMsg && (
            <p className="text-sm text-red-600 break-words">{errMsg}</p>
          )}
        </div>
      )}

      {step === "done" && out && (
        <div className="island-shell rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Session active</h2>
          <p className="text-sm">
            Add the iwallet MCP to Claude Code (or any MCP client):
          </p>
          <pre className="overflow-x-auto rounded bg-black/10 p-3 text-xs">
            {mcpAddCommand}
          </pre>
          <p className="text-xs opacity-70">
            iWallet:{" "}
            <code className="break-all">{out.iWalletAddress}</code>
            <br />
            Session: <code className="break-all">{out.sessionAddress}</code>
            <br />
            Bearer:{" "}
            <code className="break-all">{out.bearerToken}</code>
          </p>
          <p className="text-sm">
            Don't forget to send a small amount of ETH to{" "}
            <code className="break-all">{out.sessionAddress}</code> for gas.
          </p>
        </div>
      )}
    </main>
  );
}
