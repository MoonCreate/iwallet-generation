import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

const target = process.env.TARGET ?? "0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e";
const amount = process.env.AMOUNT ?? "100";

const { viem } = await network.connect("localhost");
const [sender] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

const hash = await sender.sendTransaction({
  to: target as `0x${string}`,
  value: parseEther(amount),
});

const balance = await publicClient.getBalance({ address: target as `0x${string}` });
console.log(`Sent ${amount} ETH to ${target}`);
console.log(`Tx: ${hash}`);
console.log(`Balance: ${formatEther(balance)} ETH`);
