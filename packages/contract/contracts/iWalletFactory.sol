// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {iWallet} from "./iWallet.sol";

/// @title iWalletFactory — CREATE2 factory for iWallet
/// @notice Each master deploys their iWallet at a deterministic address.
contract iWalletFactory {
    event Deployed(
        address indexed master,
        address indexed wallet,
        bytes32 salt
    );

    /// @notice Deploy an iWallet for `master` at a deterministic address.
    /// @dev `salt` lets one master deploy multiple wallets.
    function deploy(
        address master,
        bytes32 salt,
        uint256 globalDailyETHLimit,
        address[] calldata globalTokens,
        uint256[] calldata globalTokenLimits
    ) external returns (address wallet) {
        bytes32 finalSalt = keccak256(abi.encode(master, salt));
        iWallet w = new iWallet{salt: finalSalt}();
        w.initialize(
            master,
            globalDailyETHLimit,
            globalTokens,
            globalTokenLimits
        );
        wallet = address(w);
        emit Deployed(master, wallet, salt);
    }

    /// @notice Compute the deterministic address for a (master, salt) pair.
    function computeAddress(
        address master,
        bytes32 salt
    ) external view returns (address) {
        bytes32 finalSalt = keccak256(abi.encode(master, salt));
        bytes32 codeHash = keccak256(type(iWallet).creationCode);
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                finalSalt,
                                codeHash
                            )
                        )
                    )
                )
            );
    }
}
