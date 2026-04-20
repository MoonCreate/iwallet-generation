// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Policy, IPolicy} from "./interfaces/IPolicy.sol";

/// @title PolicyBase — shared policy enforcement logic
/// @notice Inherited by both PolicyWallet (EIP-7702) and PolicyProxy (fallback)
abstract contract PolicyBase is IPolicy {
    Policy internal _policy;
    address public owner;
    bool public revoked;
    uint256 public lastTxTimestamp;

    /// @dev Maps day number (block.timestamp / 86400) to total ETH spent
    mapping(uint256 => uint256) public dailySpent;

    modifier onlyOwner() {
        require(msg.sender == owner, "PolicyBase: not owner");
        _;
    }

    modifier notRevoked() {
        require(!revoked, "PolicyBase: agent revoked");
        _;
    }

    function _initPolicy(address _owner, Policy memory policy) internal {
        owner = _owner;
        _policy = policy;
        emit PolicyUpdated(address(this));
    }

    function updatePolicy(Policy calldata newPolicy) external onlyOwner {
        _policy = newPolicy;
        emit PolicyUpdated(address(this));
    }

    function revokeAgent() external onlyOwner {
        revoked = true;
        emit AgentRevoked(address(this));
    }

    function unrevokeAgent() external onlyOwner {
        revoked = false;
    }

    function getPolicy() external view returns (Policy memory) {
        return _policy;
    }

    function getDailySpent() external view returns (uint256) {
        return dailySpent[_currentDay()];
    }

    function isRevoked() external view returns (bool) {
        return revoked;
    }

    // ── Policy enforcement ──────────────────────────────────────

    function _enforcePolicy(
        address to,
        uint256 value,
        uint256 gasToUse
    ) internal notRevoked {
        // 1. Expiry
        if (_policy.expiresAt != 0) {
            require(
                block.timestamp < _policy.expiresAt,
                "PolicyViolation: agent expired"
            );
        }

        // 2. Daily spend limit
        if (_policy.dailySpendLimitETH != 0) {
            uint256 day = _currentDay();
            uint256 newTotal = dailySpent[day] + value;
            require(
                newTotal <= _policy.dailySpendLimitETH,
                "PolicyViolation: daily limit exceeded"
            );
            dailySpent[day] = newTotal;
        }

        // 3. Allowed contracts (if list is non-empty, target must be in it)
        if (_policy.allowedContracts.length > 0) {
            require(
                _isAllowedContract(to),
                "PolicyViolation: target not in allowlist"
            );
        }

        // 4. Cooldown
        if (_policy.cooldownSeconds != 0) {
            require(
                block.timestamp >= lastTxTimestamp + _policy.cooldownSeconds,
                "PolicyViolation: cooldown active"
            );
        }
        lastTxTimestamp = block.timestamp;

        // 5. Max gas
        if (_policy.maxGasPerTx != 0) {
            require(
                gasToUse <= _policy.maxGasPerTx,
                "PolicyViolation: gas too high"
            );
        }
    }

    function _isAllowedContract(address target) internal view returns (bool) {
        for (uint256 i = 0; i < _policy.allowedContracts.length; i++) {
            if (_policy.allowedContracts[i] == target) return true;
        }
        return false;
    }

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 86400;
    }
}
