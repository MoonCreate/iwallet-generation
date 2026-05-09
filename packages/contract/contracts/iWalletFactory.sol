// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {iWallet} from "./iWallet.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/// @title iWalletFactory — CREATE2 factory for upgradeable iWallets
/// @notice Each master deploys their iWallet at a deterministic address. Each
///         deployed wallet is a `BeaconProxy` delegating to the current
///         `iWallet` implementation, so the factory owner can patch logic
///         for every existing wallet in one tx via `upgradeImplementation`.
///
///         The factory itself sits behind a UUPS proxy and can also be
///         upgraded by its owner (via `upgradeToAndCall`), giving two
///         independent upgrade dimensions:
///         1. wallet logic   → `upgradeImplementation(newImpl)`
///         2. factory logic  → `upgradeToAndCall(newFactoryImpl, "")`
contract iWalletFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    /// Beacon owned by this factory; controls the iWallet logic for every
    /// wallet ever deployed by this factory.
    UpgradeableBeacon public beacon;

    event Deployed(address indexed master, address indexed wallet, bytes32 salt);
    event ImplementationUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the factory (called once via UUPS proxy).
    /// @param initialOwner    Owner of the factory and (transitively) the beacon
    /// @param walletImpl      Initial iWallet implementation address
    function initialize(address initialOwner, address walletImpl)
        external
        initializer
    {
        __Ownable_init(initialOwner);
        beacon = new UpgradeableBeacon(walletImpl, address(this));
    }

    /// @notice Only the owner can authorize UUPS upgrades to the factory.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Deploy an iWallet for `master` at a deterministic address.
    /// @dev `salt` lets one master deploy multiple wallets. The wallet is a
    ///      `BeaconProxy` so its logic can be upgraded later via the beacon.
    function deploy(
        address master,
        bytes32 salt,
        uint256 globalDailyETHLimit,
        address[] calldata globalTokens,
        uint256[] calldata globalTokenLimits
    ) external returns (address wallet) {
        bytes32 finalSalt = keccak256(abi.encode(master, salt));

        // Deploy the BeaconProxy with no init data — we initialize the
        // wallet atomically in the same tx below to prevent any front-run
        // window between deploy and initialize.
        bytes memory initcode = abi.encodePacked(
            type(BeaconProxy).creationCode,
            abi.encode(address(beacon), bytes(""))
        );
        wallet = Create2.deploy(0, finalSalt, initcode);

        iWallet(payable(wallet)).initialize(
            master,
            globalDailyETHLimit,
            globalTokens,
            globalTokenLimits
        );

        emit Deployed(master, wallet, salt);
    }

    /// @notice Compute the deterministic address for a (master, salt) pair.
    function computeAddress(
        address master,
        bytes32 salt
    ) external view returns (address) {
        bytes32 finalSalt = keccak256(abi.encode(master, salt));
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                type(BeaconProxy).creationCode,
                abi.encode(address(beacon), bytes(""))
            )
        );
        return Create2.computeAddress(finalSalt, codeHash, address(this));
    }

    /// @notice Upgrade the iWallet logic for ALL wallets in one tx.
    function upgradeImplementation(address newImplementation) external onlyOwner {
        beacon.upgradeTo(newImplementation);
        emit ImplementationUpgraded(newImplementation);
    }

    /// @notice Read the current iWallet implementation from the beacon.
    function getImplementation() external view returns (address) {
        return beacon.implementation();
    }
}
