import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress, zeroAddress, encodeFunctionData } from "viem";

describe("PolicyProxy", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, agent, recipient, unauthorized] =
    await viem.getWalletClients();

  const defaultPolicy = {
    dailySpendLimitETH: parseEther("0.1"),
    allowedTokens: [] as `0x${string}`[],
    allowedContracts: [] as `0x${string}`[],
    maxGasPerTx: 0n,
    cooldownSeconds: 0n,
    expiresAt: 0n,
  };

  async function deployProxy(policyOverrides = {}) {
    const policy = { ...defaultPolicy, ...policyOverrides };
    const proxy = await viem.deployContract("PolicyProxy", [
      owner.account.address,
      agent.account.address,
      policy,
    ]);
    // Fund the proxy with 1 ETH
    await owner.sendTransaction({
      to: proxy.address,
      value: parseEther("1"),
    });
    return proxy;
  }

  it("Should deploy with correct owner and agent", async function () {
    const proxy = await deployProxy();
    assert.equal(
      getAddress(await proxy.read.owner()),
      getAddress(owner.account.address)
    );
    assert.equal(
      getAddress(await proxy.read.agent()),
      getAddress(agent.account.address)
    );
  });

  it("Should allow agent to execute a simple ETH transfer", async function () {
    const proxy = await deployProxy();
    const balanceBefore = await publicClient.getBalance({
      address: recipient.account.address,
    });

    await proxy.write.execute(
      [recipient.account.address, parseEther("0.01"), "0x"],
      { account: agent.account }
    );

    const balanceAfter = await publicClient.getBalance({
      address: recipient.account.address,
    });
    assert.equal(balanceAfter - balanceBefore, parseEther("0.01"));
  });

  it("Should reject execution from unauthorized address", async function () {
    const proxy = await deployProxy();
    await assert.rejects(
      proxy.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: unauthorized.account }
      ),
      /PolicyProxy: not agent/
    );
  });

  it("Should enforce daily spend limit", async function () {
    const proxy = await deployProxy({
      dailySpendLimitETH: parseEther("0.05"),
    });

    // First tx: 0.03 ETH — should pass
    await proxy.write.execute(
      [recipient.account.address, parseEther("0.03"), "0x"],
      { account: agent.account }
    );

    // Second tx: 0.03 ETH — total 0.06 > 0.05 limit — should fail
    await assert.rejects(
      proxy.write.execute(
        [recipient.account.address, parseEther("0.03"), "0x"],
        { account: agent.account }
      ),
      /PolicyViolation: daily limit exceeded/
    );
  });

  it("Should track daily spend correctly", async function () {
    const proxy = await deployProxy({
      dailySpendLimitETH: parseEther("1"),
    });

    await proxy.write.execute(
      [recipient.account.address, parseEther("0.02"), "0x"],
      { account: agent.account }
    );
    await proxy.write.execute(
      [recipient.account.address, parseEther("0.03"), "0x"],
      { account: agent.account }
    );

    const spent = await proxy.read.getDailySpent();
    assert.equal(spent, parseEther("0.05"));
  });

  it("Should enforce allowed contracts whitelist", async function () {
    const proxy = await deployProxy({
      allowedContracts: [recipient.account.address],
    });

    // Sending to allowed address — should pass
    await proxy.write.execute(
      [recipient.account.address, parseEther("0.01"), "0x"],
      { account: agent.account }
    );

    // Sending to non-allowed address — should fail
    await assert.rejects(
      proxy.write.execute(
        [unauthorized.account.address, parseEther("0.01"), "0x"],
        { account: agent.account }
      ),
      /PolicyViolation: target not in allowlist/
    );
  });

  it("Should allow owner to revoke and unrevoke agent", async function () {
    const proxy = await deployProxy();

    // Revoke
    await proxy.write.revokeAgent({ account: owner.account });
    assert.equal(await proxy.read.isRevoked(), true);

    // Agent can't execute
    await assert.rejects(
      proxy.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: agent.account }
      ),
      /PolicyBase: agent revoked/
    );

    // Unrevoke
    await proxy.write.unrevokeAgent({ account: owner.account });
    assert.equal(await proxy.read.isRevoked(), false);

    // Agent can execute again
    await proxy.write.execute(
      [recipient.account.address, parseEther("0.01"), "0x"],
      { account: agent.account }
    );
  });

  it("Should allow owner to update policy", async function () {
    const proxy = await deployProxy();
    const newPolicy = {
      ...defaultPolicy,
      dailySpendLimitETH: parseEther("0.5"),
    };

    await proxy.write.updatePolicy([newPolicy], { account: owner.account });
    const policy = await proxy.read.getPolicy();
    assert.equal(policy.dailySpendLimitETH, parseEther("0.5"));
  });

  it("Should emit TransactionExecuted event", async function () {
    const proxy = await deployProxy();

    await viem.assertions.emitWithArgs(
      proxy.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: agent.account }
      ),
      proxy,
      "TransactionExecuted",
      [
        getAddress(proxy.address),
        getAddress(recipient.account.address),
        parseEther("0.01"),
        parseEther("0.01"),
      ]
    );
  });
});

describe("PolicyRegistry (UUPS Proxy)", async function () {
  const { viem } = await network.connect();
  const [owner, agent] = await viem.getWalletClients();

  const defaultPolicy = {
    dailySpendLimitETH: parseEther("0.1"),
    allowedTokens: [] as `0x${string}`[],
    allowedContracts: [] as `0x${string}`[],
    maxGasPerTx: 0n,
    cooldownSeconds: 0n,
    expiresAt: 0n,
  };

  // Helper: deploy implementation + ERC1967Proxy, return registry at proxy address
  async function deployRegistry() {
    const impl = await viem.deployContract("PolicyRegistry");

    // Encode initialize(address initialOwner)
    const initData = encodeFunctionData({
      abi: impl.abi,
      functionName: "initialize",
      args: [owner.account.address],
    });

    const proxy = await viem.deployContract("ERC1967Proxy", [
      impl.address,
      initData,
    ]);

    // Get a PolicyRegistry instance at the proxy address
    const registry = await viem.getContractAt("PolicyRegistry", proxy.address);
    return registry;
  }

  it("Should initialize with correct owner behind proxy", async function () {
    const registry = await deployRegistry();
    const registryOwner = await registry.read.owner();
    assert.equal(getAddress(registryOwner), getAddress(owner.account.address));
  });

  it("Should reject double initialization", async function () {
    const registry = await deployRegistry();
    await assert.rejects(
      registry.write.initialize([agent.account.address], {
        account: owner.account,
      }),
      /InvalidInitialization/
    );
  });

  it("Should create a wallet via proxied registry", async function () {
    const registry = await deployRegistry();

    await registry.write.createWallet(
      [agent.account.address, defaultPolicy],
      { account: owner.account }
    );

    const count = await registry.read.getWalletCount([owner.account.address]);
    assert.equal(count, 1n);

    const walletInfo = await registry.read.getWallet([
      owner.account.address,
      0n,
    ]);
    assert.equal(walletInfo.agent, getAddress(agent.account.address));
    assert.equal(walletInfo.active, true);
    assert.notEqual(walletInfo.proxy, zeroAddress);
  });

  it("Should create multiple wallets", async function () {
    const registry = await deployRegistry();

    await registry.write.createWallet(
      [agent.account.address, defaultPolicy],
      { account: owner.account }
    );
    await registry.write.createWallet(
      [agent.account.address, { ...defaultPolicy, dailySpendLimitETH: parseEther("0.5") }],
      { account: owner.account }
    );

    const count = await registry.read.getWalletCount([owner.account.address]);
    assert.equal(count, 2n);

    const all = await registry.read.getWallets([owner.account.address]);
    assert.equal(all.length, 2);
  });

  it("Should deactivate a wallet", async function () {
    const registry = await deployRegistry();

    await registry.write.createWallet(
      [agent.account.address, defaultPolicy],
      { account: owner.account }
    );

    await registry.write.deactivateWallet([0n], { account: owner.account });

    const walletInfo = await registry.read.getWallet([
      owner.account.address,
      0n,
    ]);
    assert.equal(walletInfo.active, false);
  });

  it("Should allow owner to upgrade to new implementation", async function () {
    const registry = await deployRegistry();

    // Deploy a new implementation
    const newImpl = await viem.deployContract("PolicyRegistry");

    // Upgrade via UUPS — only owner can do this
    await registry.write.upgradeToAndCall([newImpl.address, "0x"], {
      account: owner.account,
    });

    // State should be preserved — create a wallet and verify it works
    await registry.write.createWallet(
      [agent.account.address, defaultPolicy],
      { account: owner.account }
    );
    const count = await registry.read.getWalletCount([owner.account.address]);
    assert.equal(count, 1n);
  });

  it("Should reject upgrade from non-owner", async function () {
    const registry = await deployRegistry();
    const newImpl = await viem.deployContract("PolicyRegistry");

    await assert.rejects(
      registry.write.upgradeToAndCall([newImpl.address, "0x"], {
        account: agent.account,
      }),
      /OwnableUnauthorizedAccount/
    );
  });
});
