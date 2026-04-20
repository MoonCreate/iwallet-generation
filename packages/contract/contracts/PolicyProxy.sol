// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Policy} from "./interfaces/IPolicy.sol";
import {PolicyBase} from "./PolicyBase.sol";

/// @title PolicyProxy — fallback when EIP-7702 is not available
/// @notice Deployed by the master wallet. The iWallet EOA is authorized as
///         the agent signer. All transactions from the agent must be routed
///         through this proxy which enforces policy before forwarding.
contract PolicyProxy is PolicyBase {
    address public agent;

    modifier onlyAgent() {
        require(msg.sender == agent, "PolicyProxy: not agent");
        _;
    }

    /// @param _owner  The master wallet that controls policy
    /// @param _agent  The iWallet EOA address (AI agent signer)
    /// @param policy  Initial policy rules
    constructor(address _owner, address _agent, Policy memory policy) {
        agent = _agent;
        _initPolicy(_owner, policy);
    }

    /// @notice Execute a call — only callable by the authorized agent EOA
    /// @param to     Target address
    /// @param value  ETH value to send
    /// @param data   Calldata to forward
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyAgent notRevoked returns (bytes memory) {
        _enforcePolicy(to, value, gasleft());

        (bool success, bytes memory result) = to.call{value: value}(data);
        require(success, "PolicyProxy: call failed");

        emit TransactionExecuted(address(this), to, value, dailySpent[_currentDay()]);
        return result;
    }

    /// @notice Update the authorized agent address
    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    /// @notice Accept ETH to fund the proxy for agent operations
    receive() external payable {}

    fallback() external payable {}
}
