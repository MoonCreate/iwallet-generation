import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress, encodeFunctionData, zeroAddress } from "viem";

describe("iWallet", async () => {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [master, sessionA, sessionB, recipient, attacker, externalActor] =
    await viem.getWalletClients();

  // ── helpers ───────────────────────────────────────────────────

  type PolicyArg = {
    dailyETHLimit: bigint;
    allowedTokens: `0x${string}`[];
    tokenDailyLimits: bigint[];
    allowedContracts: `0x${string}`[];
    allowedSpenders: `0x${string}`[];
    cooldownSeconds: bigint;
    maxGasPerTx: bigint;
    expiresAt: bigint;
    active: boolean;
  };

  const blankPolicy = (over: Partial<PolicyArg> = {}): PolicyArg => ({
    dailyETHLimit: 0n,
    allowedTokens: [],
    tokenDailyLimits: [],
    allowedContracts: [],
    allowedSpenders: [],
    cooldownSeconds: 0n,
    maxGasPerTx: 0n,
    expiresAt: 0n,
    active: false, // ignored — iWallet sets it
    ...over,
  });

  async function deployFactoryAndWallet(opts?: {
    globalDailyETHLimit?: bigint;
    globalTokens?: `0x${string}`[];
    globalTokenLimits?: bigint[];
    salt?: `0x${string}`;
  }) {
    const factory = await viem.deployContract("iWalletFactory");
    const salt =
      opts?.salt ??
      ("0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`);
    await factory.write.deploy(
      [
        master.account.address,
        salt,
        opts?.globalDailyETHLimit ?? 0n,
        opts?.globalTokens ?? [],
        opts?.globalTokenLimits ?? [],
      ],
      { account: master.account }
    );
    const wAddr = await factory.read.computeAddress([
      master.account.address,
      salt,
    ]);
    const w = await viem.getContractAt("iWallet", wAddr);
    // fund with ETH
    await master.sendTransaction({
      to: wAddr,
      value: parseEther("10"),
    });
    return { factory, wallet: w };
  }

  async function deployToken(
    initialHolder: `0x${string}`,
    amount: bigint = 1_000_000n * 10n ** 18n
  ) {
    // Minimal ERC20 inline-deployed via a small wrapper isn't trivial in
    // Hardhat without writing a Solidity test token. Use OpenZeppelin's
    // ERC20 indirectly by deploying TestERC20 we'll add as a fixture file.
    const t = await viem.deployContract("TestERC20", [initialHolder, amount]);
    return t;
  }

  // ── tests ─────────────────────────────────────────────────────

  it("master is set, wallet can hold ETH", async () => {
    const { wallet } = await deployFactoryAndWallet();
    assert.equal(
      getAddress(await wallet.read.owner()),
      getAddress(master.account.address)
    );
    const bal = await publicClient.getBalance({ address: wallet.address });
    assert.equal(bal, parseEther("10"));
  });

  it("non-owner cannot addSession", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await assert.rejects(
      wallet.write.addSession(
        [sessionA.account.address, blankPolicy({ dailyETHLimit: parseEther("1") })],
        { account: attacker.account }
      ),
      /not owner/
    );
  });

  it("inactive session cannot execute", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: sessionA.account }
      ),
      /session inactive/
    );
  });

  it("session can send ETH within daily cap, blocked beyond", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("0.05"),
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );

    const before = await publicClient.getBalance({
      address: recipient.account.address,
    });
    await wallet.write.execute(
      [recipient.account.address, parseEther("0.03"), "0x"],
      { account: sessionA.account }
    );
    const after = await publicClient.getBalance({
      address: recipient.account.address,
    });
    assert.equal(after - before, parseEther("0.03"));

    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.03"), "0x"],
        { account: sessionA.account }
      ),
      /ETH session cap/
    );
  });

  it("global ETH cap stops cross-session over-spend", async () => {
    const { wallet } = await deployFactoryAndWallet({
      globalDailyETHLimit: parseEther("0.05"),
    });
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("1"),
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );
    await wallet.write.addSession(
      [
        sessionB.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("1"),
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );

    await wallet.write.execute(
      [recipient.account.address, parseEther("0.04"), "0x"],
      { account: sessionA.account }
    );

    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.04"), "0x"],
        { account: sessionB.account }
      ),
      /ETH global cap/
    );
  });

  it("ETH transfer blocked when session has dailyETHLimit = 0", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [sessionA.account.address, blankPolicy({ dailyETHLimit: 0n })],
      { account: master.account }
    );
    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: sessionA.account }
      ),
      /ETH not allowed/
    );
  });

  it("calls to non-allowlisted contracts are blocked when list is populated", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("1"),
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );
    await assert.rejects(
      wallet.write.execute(
        [externalActor.account.address, 0n, "0xdeadbeef"],
        { account: sessionA.account }
      ),
      /contract not allowed/
    );
  });

  it("empty allowedContracts means any target is allowed (cap still applies)", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({ dailyETHLimit: parseEther("0.1") }),
      ],
      { account: master.account }
    );
    // Empty allowlist + value > 0 → allowed (within cap)
    await wallet.write.execute(
      [externalActor.account.address, parseEther("0.05"), "0x"],
      { account: sessionA.account }
    );
    // Cap still bounds total spend
    await assert.rejects(
      wallet.write.execute(
        [externalActor.account.address, parseEther("0.06"), "0x"],
        { account: sessionA.account }
      ),
      /ETH session cap/
    );
  });

  it("ERC20 transfer enforces token cap, succeeds within, blocks beyond", async () => {
    const { wallet } = await deployFactoryAndWallet();
    const token = await deployToken(wallet.address, 1_000n * 10n ** 18n);
    const cap = 100n * 10n ** 18n;

    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          allowedTokens: [token.address],
          tokenDailyLimits: [cap],
        }),
      ],
      { account: master.account }
    );

    const transfer40 = encodeFunctionData({
      abi: token.abi,
      functionName: "transfer",
      args: [recipient.account.address, 40n * 10n ** 18n],
    });
    await wallet.write.execute([token.address, 0n, transfer40], {
      account: sessionA.account,
    });
    assert.equal(
      await token.read.balanceOf([recipient.account.address]),
      40n * 10n ** 18n
    );

    const transfer70 = encodeFunctionData({
      abi: token.abi,
      functionName: "transfer",
      args: [recipient.account.address, 70n * 10n ** 18n],
    });
    await assert.rejects(
      wallet.write.execute([token.address, 0n, transfer70], {
        account: sessionA.account,
      }),
      /token session cap/
    );
  });

  it("ERC20 approve to non-allowlisted spender is blocked", async () => {
    const { wallet } = await deployFactoryAndWallet();
    const token = await deployToken(wallet.address, 1_000n * 10n ** 18n);
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          allowedTokens: [token.address],
          tokenDailyLimits: [100n * 10n ** 18n],
          allowedSpenders: [externalActor.account.address],
        }),
      ],
      { account: master.account }
    );

    const approveAttacker = encodeFunctionData({
      abi: token.abi,
      functionName: "approve",
      args: [attacker.account.address, 50n * 10n ** 18n],
    });
    await assert.rejects(
      wallet.write.execute([token.address, 0n, approveAttacker], {
        account: sessionA.account,
      }),
      /spender not allowed/
    );

    const approveOk = encodeFunctionData({
      abi: token.abi,
      functionName: "approve",
      args: [externalActor.account.address, 50n * 10n ** 18n],
    });
    await wallet.write.execute([token.address, 0n, approveOk], {
      account: sessionA.account,
    });
    assert.equal(
      await token.read.allowance([wallet.address, externalActor.account.address]),
      50n * 10n ** 18n
    );
  });

  it("infinite approval is rejected", async () => {
    const { wallet } = await deployFactoryAndWallet();
    const token = await deployToken(wallet.address, 1_000n * 10n ** 18n);
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          allowedTokens: [token.address],
          tokenDailyLimits: [100n * 10n ** 18n],
          allowedSpenders: [externalActor.account.address],
        }),
      ],
      { account: master.account }
    );
    const max = (1n << 256n) - 1n;
    const approveMax = encodeFunctionData({
      abi: token.abi,
      functionName: "approve",
      args: [externalActor.account.address, max],
    });
    await assert.rejects(
      wallet.write.execute([token.address, 0n, approveMax], {
        account: sessionA.account,
      }),
      /no infinite approve/
    );
  });

  it("expiry blocks calls past expiresAt", async () => {
    const { wallet } = await deployFactoryAndWallet();
    const block = await publicClient.getBlock();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("1"),
          expiresAt: block.timestamp + 60n,
        }),
      ],
      { account: master.account }
    );
    // mine forward past expiry — use evm_increaseTime via test client
    const testClient = await viem.getTestClient();
    await testClient.increaseTime({ seconds: 120 });
    await testClient.mine({ blocks: 1 });

    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: sessionA.account }
      ),
      /expired/
    );
  });

  it("cooldown enforced between session txs", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("1"),
          cooldownSeconds: 60n,
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );
    await wallet.write.execute(
      [recipient.account.address, parseEther("0.01"), "0x"],
      { account: sessionA.account }
    );
    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: sessionA.account }
      ),
      /cooldown/
    );
  });

  it("revokeSession kills the session", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [sessionA.account.address, blankPolicy({ dailyETHLimit: parseEther("1") })],
      { account: master.account }
    );
    await wallet.write.revokeSession([sessionA.account.address], {
      account: master.account,
    });
    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: sessionA.account }
      ),
      /session inactive/
    );
  });

  it("pauseAll freezes all sessions", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("1"),
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );
    await wallet.write.pauseAll({ account: master.account });
    await assert.rejects(
      wallet.write.execute(
        [recipient.account.address, parseEther("0.01"), "0x"],
        { account: sessionA.account }
      ),
      /paused/
    );
    await wallet.write.resumeAll({ account: master.account });
    await wallet.write.execute(
      [recipient.account.address, parseEther("0.01"), "0x"],
      { account: sessionA.account }
    );
  });

  it("owner can withdraw ETH and ERC20", async () => {
    const { wallet } = await deployFactoryAndWallet();
    const token = await deployToken(wallet.address, 1_000n * 10n ** 18n);

    await wallet.write.withdraw(
      [zeroAddress, parseEther("1"), recipient.account.address],
      { account: master.account }
    );
    await wallet.write.withdraw(
      [token.address, 100n * 10n ** 18n, recipient.account.address],
      { account: master.account }
    );
    assert.equal(
      await token.read.balanceOf([recipient.account.address]),
      100n * 10n ** 18n
    );
  });

  it("executeBatch enforces caps across calls atomically", async () => {
    const { wallet } = await deployFactoryAndWallet();
    await wallet.write.addSession(
      [
        sessionA.account.address,
        blankPolicy({
          dailyETHLimit: parseEther("0.05"),
          allowedContracts: [recipient.account.address],
        }),
      ],
      { account: master.account }
    );

    // Two calls of 0.03 each = 0.06 > 0.05 cap → second call should make
    // the whole batch revert.
    const calls = [
      {
        to: recipient.account.address,
        value: parseEther("0.03"),
        data: "0x" as `0x${string}`,
      },
      {
        to: recipient.account.address,
        value: parseEther("0.03"),
        data: "0x" as `0x${string}`,
      },
    ];
    await assert.rejects(
      wallet.write.executeBatch([calls], {
        account: sessionA.account,
        value: parseEther("0.06"),
      }),
      /ETH session cap/
    );
  });

  it("ERC-1271 returns magic for master sig, invalid for others", async () => {
    const { wallet } = await deployFactoryAndWallet();
    const hash =
      "0x1234567890123456789012345678901234567890123456789012345678901234" as `0x${string}`;
    const masterSig = await master.signMessage({
      message: { raw: hash },
    });
    const sessionSig = await sessionA.signMessage({
      message: { raw: hash },
    });
    // The contract recovers from the raw hash, so we need to recompute
    // what message-hash was actually signed. signMessage prefixes
    // "\x19Ethereum Signed Message:\n32" — so we test against the
    // prefixed hash.
    const prefixed = (await import("viem")).hashMessage({ raw: hash });
    const okMaster = await wallet.read.isValidSignature([prefixed, masterSig]);
    const okSession = await wallet.read.isValidSignature([
      prefixed,
      sessionSig,
    ]);
    assert.equal(okMaster, "0x1626ba7e");
    assert.notEqual(okSession, "0x1626ba7e");
  });

  it("factory.computeAddress matches deployed address", async () => {
    const factory = await viem.deployContract("iWalletFactory");
    const salt =
      "0x000000000000000000000000000000000000000000000000000000000000007b" as `0x${string}`;
    const predicted = await factory.read.computeAddress([
      master.account.address,
      salt,
    ]);
    await factory.write.deploy(
      [master.account.address, salt, 0n, [], []],
      { account: master.account }
    );
    const code = await publicClient.getCode({ address: predicted });
    assert.ok(code && code !== "0x", "no code at predicted address");
  });
});
