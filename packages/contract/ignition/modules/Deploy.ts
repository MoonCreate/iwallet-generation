import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Deploy the implementation contract
const ImplementationModule = buildModule("ImplementationModule", (m) => {
  const registry = m.contract("PolicyRegistry");
  return { registry };
});

// Deploy the ERC1967 UUPS proxy pointing at the implementation
const ProxyModule = buildModule("ProxyModule", (m) => {
  const { registry } = m.useModule(ImplementationModule);

  const deployer = m.getAccount(0);

  // Encode initialize(address initialOwner)
  const initData = m.encodeFunctionCall(registry, "initialize", [deployer]);

  const proxy = m.contract("ERC1967Proxy", [registry, initData], {
    from: deployer,
  });

  return { proxy };
});

// Create a contract instance at the proxy address using the implementation ABI
export default buildModule("iWalletModule", (m) => {
  const { proxy } = m.useModule(ProxyModule);

  const registry = m.contractAt("PolicyRegistry", proxy);

  return { registry, proxy };
});
