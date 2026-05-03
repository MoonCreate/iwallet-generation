// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct Policy {
    uint256 dailyETHLimit;
    address[] allowedTokens;
    uint256[] tokenDailyLimits;       // parallel array to allowedTokens
    address[] allowedContracts;
    address[] allowedSpenders;        // valid `approve` spender targets
    uint256 cooldownSeconds;
    uint256 maxGasPerTx;
    uint256 expiresAt;
    bool    active;
}

struct Call {
    address to;
    uint256 value;
    bytes data;
}

interface IiWallet {
    event SessionAdded(address indexed session);
    event SessionRevoked(address indexed session);
    event SessionPolicyUpdated(address indexed session);
    event TransactionExecuted(
        address indexed session,
        address indexed to,
        uint256 value,
        bytes4 selector
    );
    event GlobalLimitsUpdated();
    event Paused();
    event Resumed();
    event Withdrawn(address indexed token, uint256 amount, address indexed to);
}
