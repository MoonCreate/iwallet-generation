// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy as OZProxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @dev Thin wrapper to force Hardhat to compile and emit an artifact.
contract ERC1967Proxy is OZProxy {
    constructor(address implementation, bytes memory _data) OZProxy(implementation, _data) {}
}
