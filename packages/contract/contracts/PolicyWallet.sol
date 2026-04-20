// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Policy} from "./interfaces/IPolicy.sol";
import {PolicyBase} from "./PolicyBase.sol";

/// @title PolicyWallet — EIP-7702 delegation target
/// @notice When an iWallet EOA delegates to this contract via EIP-7702,
///         all outbound calls are gated by the configured policy rules.
///         The owner (master wallet) sets the policy; the iWallet EOA's
///         private key (held by the AI agent) can only execute within bounds.
contract PolicyWallet is PolicyBase {
    bool private _initialized;

    /// @notice Initialize the wallet — callable once after EIP-7702 delegation
    /// @param _owner  The master wallet address that controls the policy
    /// @param policy  The initial policy rules
    function initialize(address _owner, Policy calldata policy) external {
        require(!_initialized, "PolicyWallet: already initialized");
        _initialized = true;
        _initPolicy(_owner, policy);
    }

    /// @notice Execute a call from the iWallet, enforcing policy rules
    /// @param to     Target contract or address
    /// @param value  ETH value to send
    /// @param data   Calldata to forward
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable notRevoked returns (bytes memory) {
        _enforcePolicy(to, value, gasleft());

        (bool success, bytes memory result) = to.call{value: value}(data);
        require(success, "PolicyWallet: call failed");

        emit TransactionExecuted(address(this), to, value, dailySpent[_currentDay()]);
        return result;
    }

    /// @notice Accept ETH — counts toward daily limit
    receive() external payable {
        if (_policy.dailySpendLimitETH != 0) {
            // Receiving ETH doesn't count toward spend, only outbound does
        }
    }

    fallback() external payable {}
}
