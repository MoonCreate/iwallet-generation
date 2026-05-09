import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module that deploys the upgradeable iWalletFactory stack:
 *
 *   1. iWallet implementation (logic behind every wallet's BeaconProxy)
 *   2. iWalletFactory implementation (UUPS logic)
 *   3. ERC1967Proxy in front of the factory, initialized with
 *      (deployer, walletImpl) → factory becomes the user-facing address
 *      and deploys an UpgradeableBeacon owned by itself.
 *
 * Run:
 *   bunx hardhat ignition deploy ignition/modules/iWalletFactory.ts --network localhost
 *   bunx hardhat ignition deploy ignition/modules/iWalletFactory.ts --network zeroGTestnet
 *
 * After deploy: scripts/sync-deployments.ts picks up the proxy address and
 * writes it into packages/chains/src/deployments.ts.
 */
const ImplementationsModule = buildModule("iWalletImplementationsModule", (m) => {
  const walletImpl = m.contract("iWallet", [], { id: "iWalletImplementation" });
  const factoryImpl = m.contract("iWalletFactory", [], {
    id: "iWalletFactoryImplementation",
  });
  return { walletImpl, factoryImpl };
});

export default buildModule("iWalletFactoryModule", (m) => {
  const { walletImpl, factoryImpl } = m.useModule(ImplementationsModule);

  const deployer = m.getAccount(0);

  // Encode initialize(initialOwner, walletImpl)
  const initData = m.encodeFunctionCall(factoryImpl, "initialize", [
    deployer,
    walletImpl,
  ]);

  // ERC1967Proxy (the user-facing factory address). Named iWalletFactory
  // here so sync-deployments.ts picks it up under the existing key.
  const factoryProxy = m.contract(
    "ERC1967Proxy",
    [factoryImpl, initData],
    { from: deployer, id: "iWalletFactory" }
  );

  // Surface a typed contract instance at the proxy address.
  const factory = m.contractAt("iWalletFactory", factoryProxy, {
    id: "iWalletFactoryProxy",
  });

  return { factory, walletImpl, factoryImpl, factoryProxy };
});
