import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module that deploys iWalletFactory.
 *
 * Run:
 *   bunx hardhat ignition deploy ignition/modules/iWalletFactory.ts --network localhost
 *   bunx hardhat ignition deploy ignition/modules/iWalletFactory.ts --network zeroGTestnet
 *
 * Ignition is idempotent: running again on the same network skips the
 * deployment if the address exists. State lives in
 * ignition/deployments/chain-<id>/.
 */
export default buildModule("iWalletFactoryModule", (m) => {
  const factory = m.contract("iWalletFactory");
  return { factory };
});
