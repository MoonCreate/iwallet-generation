// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
	function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title MockRouter — minimal contract that pulls ERC20 tokens from a sender
/// @notice Used in tests to expose the architectural bypass where session
///         token caps don't fire when tokens are spent via a contract that
///         pulls already-approved tokens (the call selector isn't a direct
///         ERC-20 selector, so iWallet's calldata-aware gating doesn't engage
///         the token-cap path).
contract MockRouter {
	function pull(address token, address from, uint256 amount) external {
		IERC20(token).transferFrom(from, address(this), amount);
	}
}
