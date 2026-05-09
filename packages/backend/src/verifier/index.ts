/**
 * Auto-verifier for newly-deployed iWallets.
 *
 * Subscribes to `factory.Deployed` events on every supported chain that
 * has a deployed factory + a configured explorer API URL, and submits the
 * BeaconProxy bytecode for source verification on each new wallet.
 *
 * Idempotent: every user wallet has identical BeaconProxy bytecode and
 * constructor args (only the beacon address differs per chain), so the
 * standard JSON input is shared across all calls and embedded as a
 * static asset in @iwallet/chains. The beacon address is read from
 * factory.beacon() the first time we see an event for that chain.
 */

import {
  createPublicClient,
  http,
  encodeAbiParameters,
  type Address,
  type Chain,
} from "viem";
import {
  BEACON_PROXY_VERIFICATION as beaconProxyVerification,
  EXPLORER_API_URLS,
  IWALLET_FACTORY_ABI,
  SUPPORTED_CHAINS,
  getFactoryAddressForChain,
} from "@iwallet/chains";

interface VerifierState {
  chain: Chain;
  apiUrl: string;
  factory: Address;
  beacon: Address | null;
  unwatch: (() => void) | null;
}

const states = new Map<number, VerifierState>();

export function startVerifier(): void {
  for (const chain of SUPPORTED_CHAINS) {
    const apiUrl = EXPLORER_API_URLS[chain.id];
    if (!apiUrl) continue; // localhost / no explorer

    const factory = getFactoryAddressForChain(chain.id);
    if (!factory) continue; // factory not deployed on this chain yet

    const state: VerifierState = {
      chain,
      apiUrl,
      factory,
      beacon: null,
      unwatch: null,
    };
    states.set(chain.id, state);

    const client = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });

    const unwatch = client.watchContractEvent({
      address: factory,
      abi: IWALLET_FACTORY_ABI,
      eventName: "Deployed",
      onLogs: (logs) => {
        for (const log of logs) {
          const wallet = (log.args as { wallet?: Address }).wallet;
          if (!wallet) continue;
          // Fire-and-forget — don't block the event loop on the explorer
          // round-trip. Log results for ops visibility.
          void verifyOnce(wallet, chain.id).catch((e) => {
            console.error(
              `[verifier] ${chain.name} ${wallet}: caught`,
              e instanceof Error ? e.message : e
            );
          });
        }
      },
      onError: (err) => {
        console.error(
          `[verifier] watch error on ${chain.name}:`,
          err instanceof Error ? err.message : err
        );
      },
    });
    state.unwatch = unwatch;

    console.log(
      `[verifier] watching factory.Deployed on ${chain.name} (${chain.id}) at ${factory}`
    );
  }
}

export function stopVerifier(): void {
  for (const state of states.values()) {
    state.unwatch?.();
  }
  states.clear();
}

/**
 * Verify a single iWallet (BeaconProxy) address on the explorer
 * configured for the given chain. Reusable for retries / manual
 * re-verification too.
 */
export async function verifyOnce(
  walletAddress: Address,
  chainId: number
): Promise<{ ok: boolean; message: string }> {
  const state = states.get(chainId);
  if (!state) return { ok: false, message: `chain ${chainId} not watched` };

  // Lazy-load beacon address (one-time per chain).
  if (!state.beacon) {
    const client = createPublicClient({
      chain: state.chain,
      transport: http(state.chain.rpcUrls.default.http[0]),
    });
    state.beacon = (await client.readContract({
      address: state.factory,
      abi: IWALLET_FACTORY_ABI,
      functionName: "beacon",
    })) as Address;
  }

  // BeaconProxy(address beacon, bytes "") constructor args, hex without 0x.
  const ctorArgs = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [state.beacon, "0x"]
  ).slice(2);

  const form = new URLSearchParams();
  form.set("module", "contract");
  form.set("action", "verifysourcecode");
  form.set("contractaddress", walletAddress);
  form.set("sourceCode", JSON.stringify(beaconProxyVerification.standardInput));
  form.set("codeformat", "solidity-standard-json-input");
  form.set("contractname", beaconProxyVerification.contractName);
  form.set("compilerversion", beaconProxyVerification.compilerVersion);
  form.set(
    "optimizationUsed",
    beaconProxyVerification.optimizer.enabled ? "1" : "0"
  );
  form.set("runs", String(beaconProxyVerification.optimizer.runs));
  form.set("evmversion", beaconProxyVerification.evmVersion);
  form.set("constructorArguements", ctorArgs);

  console.log(
    `[verifier] submitting ${walletAddress} on ${state.chain.name}…`
  );
  const submitRes = await fetch(state.apiUrl, {
    method: "POST",
    body: form,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  const submit = (await submitRes.json()) as {
    status: string;
    message: string;
    result: string;
  };

  if (submit.status !== "1") {
    // "Already Verified" is common + benign — explorer returns status 0
    // with a message indicating the address is already verified.
    if (/already verified/i.test(submit.result || submit.message)) {
      console.log(`[verifier] ${walletAddress}: already verified, skipping`);
      return { ok: true, message: "already verified" };
    }
    console.warn(
      `[verifier] ${walletAddress}: submit rejected:`,
      submit.message,
      submit.result
    );
    return { ok: false, message: submit.result || submit.message };
  }

  const guid = submit.result;
  // Best-effort poll for confirmation. We don't retry aggressively — most
  // verifications resolve in <30s; if not, the explorer eventually catches
  // up async and the next deploy will surface the result.
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 5_000));
    const url = `${state.apiUrl}?module=contract&action=checkverifystatus&guid=${guid}`;
    const r = await fetch(url);
    const j = (await r.json()) as {
      status: string;
      message: string;
      result: string;
    };
    if (j.status === "1") {
      console.log(`[verifier] ${walletAddress}: verified ✓`);
      return { ok: true, message: j.result || "verified" };
    }
    if (j.result && !/pending/i.test(j.result)) {
      console.warn(
        `[verifier] ${walletAddress}: poll terminal failure:`,
        j.result
      );
      return { ok: false, message: j.result };
    }
  }
  console.warn(`[verifier] ${walletAddress}: poll timeout, GUID=${guid}`);
  return { ok: false, message: "timeout" };
}
