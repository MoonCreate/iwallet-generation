/**
 * @iwallet/tokens — registry of ERC-20 tokens iWallet officially supports
 * per chain.
 *
 * Add a token by appending an entry under the right chainId in
 * SUPPORTED_TOKENS below. The frontend automatically renders a balance
 * card for every entry on the user's connected chain. Tokens with the
 * zero address are filtered out, so leaving placeholders is harmless.
 *
 * Why a separate package (instead of co-locating in @iwallet/chains):
 * chains is for chain *infrastructure* (RPC, explorer, factory contract
 * addresses, ABIs). Token lists are application data that changes
 * independently and is curated separately, often by a non-engineer
 * adding a new asset.
 */

import { zeroGMainnet, zeroGTestnet } from "@iwallet/chains";

/**
 * Zero address sentinel — used to represent the native gas token (0G on
 * 0G chains, ETH elsewhere) in the same shape as ERC-20s. This matches
 * how `iWallet.withdraw(0x0, amount, to)` already treats native funds,
 * so the FE/SDK don't need a separate type.
 */
export const NATIVE_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

export interface SupportedToken {
  /** Display ticker, e.g. "USDC". */
  symbol: string;
  /** Long name shown under the symbol on the dashboard card. */
  name: string;
  /**
   * ERC-20 contract address on this chain — or `NATIVE_ADDRESS` (zero
   * address) for the native gas token.
   */
  address: `0x${string}`;
  /** ERC-20 decimals — used to short-circuit the on-chain decimals() read. */
  decimals: number;
  /** Optional logo URL. Falls back to a symbol bubble when absent. */
  logo?: string;
}

/** True iff the address is the zero-address sentinel for the native token. */
export function isNativeToken(t: { address: string }): boolean {
  return t.address.toLowerCase() === NATIVE_ADDRESS;
}

/**
 * Per-chain registry. The frontend filters out any entry whose address
 * is the zero address, so placeholders are safe.
 *
 * Replace `0x0000…0` with the real deployed token contract on that chain.
 */
/**
 * Native 0G entry — same shape as an ERC-20 but with the zero-address
 * sentinel. Reused on both chains since native is always 0G.
 */
const NATIVE_0G: SupportedToken = {
  symbol: "0G",
  name: "0G (native)",
  address: NATIVE_ADDRESS,
  decimals: 18,
  logo: "https://cdn.oku.trade/logos/16661/0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c.png",
};

export const SUPPORTED_TOKENS: Record<number, SupportedToken[]> = {
  [zeroGTestnet.id]: [
    NATIVE_0G,
    {
      symbol: "W0G",
      name: "Wrapped 0G",
      address: "0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c",
      decimals: 18,
      logo: "https://cdn.oku.trade/logos/16661/0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c.png",
    },
  ],
  [zeroGMainnet.id]: [
    NATIVE_0G,
    {
      symbol: "W0G",
      name: "Wrapped 0G",
      address: "0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c",
      decimals: 18,
      logo: "https://cdn.oku.trade/logos/16661/0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c.png",
    },
    {
      symbol: "WBTC",
      name: "Wrapped BTC",
      address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
      decimals: 8,
      logo: "https://cdn.oku.trade/logos/16661/0x0555e30da8f98308edb960aa94c0db47230d2b9c.png",
    },
    {
      symbol: "WETH",
      name: "Wrapped ETH",
      address: "0x564770837Ef8bbF077cFe54E5f6106538c815B22",
      decimals: 18,
      logo: "https://cdn.oku.trade/logos/16661/0x564770837ef8bbf077cfe54e5f6106538c815b22.png",
    },
    {
      symbol: "USDC",
      name: "Bridged USDC",
      address: "0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E",
      decimals: 6,
      logo: "https://cdn.oku.trade/logos/16661/0x1f3aa82227281ca364bfb3d253b0f1af1da6473e.png",
    },
  ],
};

/** Resolve the supported tokens for a chain (native + ERC-20s). */
export function getSupportedTokens(chainId: number): SupportedToken[] {
  return SUPPORTED_TOKENS[chainId] ?? [];
}
