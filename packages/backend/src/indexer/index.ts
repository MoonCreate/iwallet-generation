import {
  createPublicClient,
  http,
  parseAbiItem,
  formatEther,
  type Chain,
} from "viem";
import { POLICY_PROXY_ABI } from "@iwallet/chains";

export interface IndexedEvent {
  type: "TransactionExecuted" | "PolicyViolation" | "AgentRevoked";
  wallet: string;
  timestamp: number;
  data: Record<string, string>;
  txHash: string;
}

const eventStore: Map<string, IndexedEvent[]> = new Map();

export function getEvents(proxyAddress: string): IndexedEvent[] {
  return eventStore.get(proxyAddress.toLowerCase()) ?? [];
}

export function startIndexer(
  proxyAddress: `0x${string}`,
  chain: Chain,
  rpcUrl: string
) {
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Watch TransactionExecuted events
  client.watchContractEvent({
    address: proxyAddress,
    abi: POLICY_PROXY_ABI,
    eventName: "TransactionExecuted",
    onLogs: (logs) => {
      for (const log of logs) {
        const event: IndexedEvent = {
          type: "TransactionExecuted",
          wallet: proxyAddress,
          timestamp: Date.now(),
          data: {
            to: (log.args as { to?: string }).to ?? "",
            value: formatEther(
              ((log.args as { value?: bigint }).value) ?? 0n
            ),
            dailyTotal: formatEther(
              ((log.args as { dailyTotal?: bigint }).dailyTotal) ?? 0n
            ),
          },
          txHash: log.transactionHash ?? "",
        };
        addEvent(proxyAddress, event);
      }
    },
  });

  // Watch AgentRevoked events
  client.watchContractEvent({
    address: proxyAddress,
    abi: POLICY_PROXY_ABI,
    eventName: "AgentRevoked",
    onLogs: (logs) => {
      for (const log of logs) {
        const event: IndexedEvent = {
          type: "AgentRevoked",
          wallet: proxyAddress,
          timestamp: Date.now(),
          data: {},
          txHash: log.transactionHash ?? "",
        };
        addEvent(proxyAddress, event);
      }
    },
  });

  console.log(`Indexer started for proxy ${proxyAddress}`);
}

function addEvent(proxyAddress: string, event: IndexedEvent) {
  const key = proxyAddress.toLowerCase();
  const events = eventStore.get(key) ?? [];
  events.push(event);
  // Keep only last 100 events per proxy
  if (events.length > 100) events.shift();
  eventStore.set(key, events);
  console.log(`[Indexer] ${event.type}:`, event.data);
}
