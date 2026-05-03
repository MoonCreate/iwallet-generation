import {
  createPublicClient,
  http,
  formatEther,
  type Chain,
} from "viem";
import { IWALLET_ABI } from "@iwallet/chains";

export interface IndexedEvent {
  type:
    | "TransactionExecuted"
    | "SessionAdded"
    | "SessionRevoked"
    | "Paused"
    | "Resumed";
  wallet: string;
  timestamp: number;
  data: Record<string, string>;
  txHash: string;
}

const eventStore: Map<string, IndexedEvent[]> = new Map();
const startedFor = new Set<string>();

export function getEvents(walletAddress: string): IndexedEvent[] {
  return eventStore.get(walletAddress.toLowerCase()) ?? [];
}

export function startIndexer(
  walletAddress: `0x${string}`,
  chain: Chain,
  rpcUrl: string
) {
  const key = walletAddress.toLowerCase();
  if (startedFor.has(key)) return;
  startedFor.add(key);

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  client.watchContractEvent({
    address: walletAddress,
    abi: IWALLET_ABI,
    eventName: "TransactionExecuted",
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as {
          session?: string;
          to?: string;
          value?: bigint;
          selector?: string;
        };
        addEvent(walletAddress, {
          type: "TransactionExecuted",
          wallet: walletAddress,
          timestamp: Date.now(),
          data: {
            session: a.session ?? "",
            to: a.to ?? "",
            value: formatEther(a.value ?? 0n),
            selector: a.selector ?? "",
          },
          txHash: log.transactionHash ?? "",
        });
      }
    },
  });

  client.watchContractEvent({
    address: walletAddress,
    abi: IWALLET_ABI,
    eventName: "SessionRevoked",
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as { session?: string };
        addEvent(walletAddress, {
          type: "SessionRevoked",
          wallet: walletAddress,
          timestamp: Date.now(),
          data: { session: a.session ?? "" },
          txHash: log.transactionHash ?? "",
        });
      }
    },
  });

  console.log(`[Indexer] watching iWallet ${walletAddress}`);
}

function addEvent(walletAddress: string, event: IndexedEvent) {
  const key = walletAddress.toLowerCase();
  const events = eventStore.get(key) ?? [];
  events.push(event);
  if (events.length > 100) events.shift();
  eventStore.set(key, events);
}
