// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct Policy {
    uint256 dailySpendLimitETH;
    address[] allowedTokens;
    address[] allowedContracts;
    uint256 maxGasPerTx;
    uint256 cooldownSeconds;
    uint256 expiresAt;
}

interface IPolicy {
    event PolicyUpdated(address indexed wallet);
    event TransactionExecuted(
        address indexed wallet,
        address indexed to,
        uint256 value,
        uint256 dailyTotal
    );
    event PolicyViolation(
        address indexed wallet,
        string reason
    );
    event AgentRevoked(address indexed wallet);

    function getPolicy() external view returns (Policy memory);
    function getDailySpent() external view returns (uint256);
    function isRevoked() external view returns (bool);
}
