import { keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAddress } from "viem/accounts";

/**
 * Derive a deterministic iWallet address from a master wallet signature.
 *
 * Flow:
 * 1. Compute message = keccak256("iWallet-{index}")
 * 2. Master wallet signs the message hash
 * 3. First 32 bytes of signature = deterministic private key
 * 4. Derive public address from that private key
 *
 * The private key is NEVER stored on the frontend — only the address is kept.
 * The backend derives the private key again from the signature when needed.
 */
export function deriveIWalletAddress(signature: Hex): {
  address: `0x${string}`;
} {
  // Use first 32 bytes (64 hex chars + 0x prefix) as deterministic private key
  const privateKey = (signature.slice(0, 66)) as `0x${string}`;
  const address = privateKeyToAddress(privateKey);
  return { address };
}

/**
 * Compute the message that needs to be signed for a given iWallet index.
 * Returns the raw bytes that should be passed to signMessage.
 */
export function getIWalletMessage(index: number): Uint8Array {
  const message = `iWallet-${index}`;
  const msgHash = keccak256(toBytes(message));
  return toBytes(msgHash);
}
