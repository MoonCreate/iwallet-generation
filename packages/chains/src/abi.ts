export const POLICY_PROXY_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_agent", type: "address" },
      {
        name: "policy",
        type: "tuple",
        components: [
          { name: "dailySpendLimitETH", type: "uint256" },
          { name: "allowedTokens", type: "address[]" },
          { name: "allowedContracts", type: "address[]" },
          { name: "maxGasPerTx", type: "uint256" },
          { name: "cooldownSeconds", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getPolicy",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "dailySpendLimitETH", type: "uint256" },
          { name: "allowedTokens", type: "address[]" },
          { name: "allowedContracts", type: "address[]" },
          { name: "maxGasPerTx", type: "uint256" },
          { name: "cooldownSeconds", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDailySpent",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRevoked",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "agent",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "revoked",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "updatePolicy",
    inputs: [
      {
        name: "newPolicy",
        type: "tuple",
        components: [
          { name: "dailySpendLimitETH", type: "uint256" },
          { name: "allowedTokens", type: "address[]" },
          { name: "allowedContracts", type: "address[]" },
          { name: "maxGasPerTx", type: "uint256" },
          { name: "cooldownSeconds", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAgent",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unrevokeAgent",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAgent",
    inputs: [{ name: "_agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "PolicyUpdated",
    inputs: [{ name: "wallet", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "TransactionExecuted",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
      { name: "dailyTotal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyViolation",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentRevoked",
    inputs: [{ name: "wallet", type: "address", indexed: true }],
  },
] as const;

export const POLICY_REGISTRY_ABI = [
  {
    type: "function",
    name: "createWallet",
    inputs: [
      { name: "agent", type: "address" },
      {
        name: "policy",
        type: "tuple",
        components: [
          { name: "dailySpendLimitETH", type: "uint256" },
          { name: "allowedTokens", type: "address[]" },
          { name: "allowedContracts", type: "address[]" },
          { name: "maxGasPerTx", type: "uint256" },
          { name: "cooldownSeconds", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "proxy", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getWalletCount",
    inputs: [{ name: "_owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWallet",
    inputs: [
      { name: "_owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "proxy", type: "address" },
          { name: "agent", type: "address" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWallets",
    inputs: [{ name: "_owner", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "proxy", type: "address" },
          { name: "agent", type: "address" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deactivateWallet",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "WalletCreated",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "proxy", type: "address", indexed: false },
      { name: "index", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WalletDeactivated",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "proxy", type: "address", indexed: false },
      { name: "index", type: "uint256", indexed: false },
    ],
  },
] as const;
