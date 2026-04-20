// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Policy} from "./interfaces/IPolicy.sol";
import {PolicyProxy} from "./PolicyProxy.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title PolicyRegistry — upgradeable factory + registry for iWallet proxies
/// @notice Deployed behind a UUPS proxy. Users call createWallet() to deploy
///         a PolicyProxy for their AI agent. The registry tracks all deployed
///         wallets per owner. The contract owner can upgrade the implementation.
contract PolicyRegistry is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    struct WalletInfo {
        address proxy;
        address agent;
        bool active;
    }

    /// owner → list of deployed wallet infos
    mapping(address => WalletInfo[]) public wallets;

    /// proxy address → owner address (reverse lookup)
    mapping(address => address) public proxyOwner;

    event WalletCreated(
        address indexed owner,
        address indexed agent,
        address proxy,
        uint256 index
    );

    event WalletDeactivated(
        address indexed owner,
        address proxy,
        uint256 index
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the registry (called once via proxy)
    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

    /// @notice Only the owner can authorize upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Deploy a new PolicyProxy for an AI agent
    /// @param agent   The iWallet EOA (derived key) address
    /// @param policy  Initial policy rules
    /// @return proxy  The deployed PolicyProxy address
    function createWallet(
        address agent,
        Policy calldata policy
    ) external returns (address proxy) {
        PolicyProxy p = new PolicyProxy(msg.sender, agent, policy);
        proxy = address(p);

        wallets[msg.sender].push(WalletInfo({
            proxy: proxy,
            agent: agent,
            active: true
        }));
        proxyOwner[proxy] = msg.sender;

        uint256 index = wallets[msg.sender].length - 1;
        emit WalletCreated(msg.sender, agent, proxy, index);
    }

    /// @notice Get number of wallets for an owner
    function getWalletCount(address _owner) external view returns (uint256) {
        return wallets[_owner].length;
    }

    /// @notice Get wallet info by owner and index
    function getWallet(
        address _owner,
        uint256 index
    ) external view returns (WalletInfo memory) {
        return wallets[_owner][index];
    }

    /// @notice Get all wallets for an owner
    function getWallets(
        address _owner
    ) external view returns (WalletInfo[] memory) {
        return wallets[_owner];
    }

    /// @notice Mark a wallet as deactivated in the registry
    function deactivateWallet(uint256 index) external {
        require(index < wallets[msg.sender].length, "PolicyRegistry: invalid index");
        wallets[msg.sender][index].active = false;
        emit WalletDeactivated(msg.sender, wallets[msg.sender][index].proxy, index);
    }
}
