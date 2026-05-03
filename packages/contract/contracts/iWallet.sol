// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Policy, Call, IiWallet} from "./interfaces/IiWallet.sol";

/// @title iWallet — agent-bounded smart wallet
/// @notice Holds funds. Owner (master EOA) has full control. Sessions are
///         scoped EOAs that can act only within their per-session policy.
contract iWallet is IiWallet {
    // ── ERC-1271 ────────────────────────────────────────────────
    bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    // ── ERC20 selectors ─────────────────────────────────────────
    bytes4 internal constant SEL_TRANSFER = 0xa9059cbb;
    bytes4 internal constant SEL_TRANSFER_FROM = 0x23b872dd;
    bytes4 internal constant SEL_APPROVE = 0x095ea7b3;

    // ── Storage ─────────────────────────────────────────────────
    address public owner;
    bool public paused;

    // Per-session
    mapping(address => Policy) internal _policies;
    mapping(address => uint256) public lastTxTimestamp;
    mapping(uint256 => mapping(address => uint256)) public sessionEthSpent;
    mapping(uint256 => mapping(address => mapping(address => uint256)))
        public sessionTokenSpent;

    // Global kill-switch
    uint256 public globalDailyETHLimit;
    mapping(uint256 => uint256) public globalEthSpent;
    mapping(address => uint256) public globalTokenDailyLimit;
    mapping(uint256 => mapping(address => uint256)) public globalTokenSpent;

    bool private _initialized;

    modifier onlyOwner() {
        require(msg.sender == owner, "iWallet: not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "iWallet: paused");
        _;
    }

    function initialize(
        address _owner,
        uint256 _globalDailyETHLimit,
        address[] calldata _globalTokens,
        uint256[] calldata _globalTokenLimits
    ) external {
        require(!_initialized, "iWallet: already init");
        require(_owner != address(0), "iWallet: zero owner");
        require(
            _globalTokens.length == _globalTokenLimits.length,
            "iWallet: len mismatch"
        );
        _initialized = true;
        owner = _owner;
        globalDailyETHLimit = _globalDailyETHLimit;
        for (uint256 i = 0; i < _globalTokens.length; i++) {
            globalTokenDailyLimit[_globalTokens[i]] = _globalTokenLimits[i];
        }
        emit GlobalLimitsUpdated();
    }

    // ── Owner controls ──────────────────────────────────────────

    function addSession(
        address session,
        Policy calldata policy
    ) external onlyOwner {
        require(session != address(0), "iWallet: zero session");
        require(_policies[session].active == false, "iWallet: exists");
        require(
            policy.allowedTokens.length == policy.tokenDailyLimits.length,
            "iWallet: token len mismatch"
        );
        Policy storage p = _policies[session];
        _writePolicy(p, policy);
        p.active = true;
        emit SessionAdded(session);
    }

    function updateSessionPolicy(
        address session,
        Policy calldata policy
    ) external onlyOwner {
        require(_policies[session].active, "iWallet: no session");
        require(
            policy.allowedTokens.length == policy.tokenDailyLimits.length,
            "iWallet: token len mismatch"
        );
        Policy storage p = _policies[session];
        _writePolicy(p, policy);
        p.active = true;
        emit SessionPolicyUpdated(session);
    }

    function revokeSession(address session) external onlyOwner {
        _policies[session].active = false;
        emit SessionRevoked(session);
    }

    function setGlobalLimits(
        uint256 _globalDailyETHLimit,
        address[] calldata tokens,
        uint256[] calldata limits
    ) external onlyOwner {
        require(tokens.length == limits.length, "iWallet: len mismatch");
        globalDailyETHLimit = _globalDailyETHLimit;
        for (uint256 i = 0; i < tokens.length; i++) {
            globalTokenDailyLimit[tokens[i]] = limits[i];
        }
        emit GlobalLimitsUpdated();
    }

    function pauseAll() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function resumeAll() external onlyOwner {
        paused = false;
        emit Resumed();
    }

    function withdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(to != address(0), "iWallet: zero to");
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "iWallet: eth withdraw");
        } else {
            (bool ok, bytes memory ret) = token.call(
                abi.encodeWithSelector(SEL_TRANSFER, to, amount)
            );
            require(
                ok && (ret.length == 0 || abi.decode(ret, (bool))),
                "iWallet: erc20 withdraw"
            );
        }
        emit Withdrawn(token, amount, to);
    }

    /// @notice Owner can execute any call from iWallet's identity (full power).
    function executeAsOwner(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyOwner returns (bytes memory) {
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        require(ok, "iWallet: owner call failed");
        return ret;
    }

    // ── Session entrypoints ─────────────────────────────────────

    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable notPaused returns (bytes memory) {
        Policy storage p = _policies[msg.sender];
        require(p.active, "iWallet: session inactive");
        _enforceCooldown(p);
        _enforcePerCall(p, to, value, data);
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        require(ok, "iWallet: call failed");
        bytes4 sel = data.length >= 4 ? bytes4(data[:4]) : bytes4(0);
        emit TransactionExecuted(msg.sender, to, value, sel);
        return ret;
    }

    function executeBatch(
        Call[] calldata calls
    ) external payable notPaused returns (bytes[] memory results) {
        Policy storage p = _policies[msg.sender];
        require(p.active, "iWallet: session inactive");
        _enforceCooldown(p);
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            Call calldata c = calls[i];
            _enforcePerCall(p, c.to, c.value, c.data);
            (bool ok, bytes memory ret) = c.to.call{value: c.value}(c.data);
            require(ok, "iWallet: batch call failed");
            results[i] = ret;
            bytes4 sel = c.data.length >= 4 ? bytes4(c.data[:4]) : bytes4(0);
            emit TransactionExecuted(msg.sender, c.to, c.value, sel);
        }
    }

    // ── ERC-1271 (master-only in v1) ────────────────────────────

    function isValidSignature(
        bytes32 hash,
        bytes calldata sig
    ) external view returns (bytes4) {
        if (sig.length != 65) return ERC1271_INVALID;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) return ERC1271_INVALID;
        return signer == owner ? ERC1271_MAGIC : ERC1271_INVALID;
    }

    // ── Reads ────────────────────────────────────────────────────

    function getSessionPolicy(
        address session
    ) external view returns (Policy memory) {
        return _policies[session];
    }

    function isSessionActive(address session) external view returns (bool) {
        return _policies[session].active;
    }

    function getSessionDailyEthSpent(
        address session
    ) external view returns (uint256) {
        return sessionEthSpent[_currentDay()][session];
    }

    function getSessionDailyTokenSpent(
        address session,
        address token
    ) external view returns (uint256) {
        return sessionTokenSpent[_currentDay()][session][token];
    }

    function getGlobalDailyEthSpent() external view returns (uint256) {
        return globalEthSpent[_currentDay()];
    }

    function getGlobalDailyTokenSpent(
        address token
    ) external view returns (uint256) {
        return globalTokenSpent[_currentDay()][token];
    }

    // ── Receive ETH/tokens ──────────────────────────────────────

    receive() external payable {}

    // ── Internals ───────────────────────────────────────────────

    function _enforceCooldown(Policy storage p) internal {
        if (p.cooldownSeconds != 0) {
            require(
                block.timestamp >=
                    lastTxTimestamp[msg.sender] + p.cooldownSeconds,
                "Policy: cooldown"
            );
        }
        lastTxTimestamp[msg.sender] = block.timestamp;
    }

    function _enforcePerCall(
        Policy storage p,
        address to,
        uint256 value,
        bytes calldata data
    ) internal {
        // expiry
        if (p.expiresAt != 0) {
            require(block.timestamp < p.expiresAt, "Policy: expired");
        }
        // gas
        if (p.maxGasPerTx != 0) {
            require(gasleft() <= p.maxGasPerTx, "Policy: gas too high");
        }
        // ETH spend (per-session + global)
        if (value > 0) {
            uint256 day = _currentDay();
            require(
                p.dailyETHLimit != 0,
                "Policy: ETH not allowed"
            );
            uint256 sessNew = sessionEthSpent[day][msg.sender] + value;
            require(sessNew <= p.dailyETHLimit, "Policy: ETH session cap");
            sessionEthSpent[day][msg.sender] = sessNew;

            if (globalDailyETHLimit != 0) {
                uint256 globNew = globalEthSpent[day] + value;
                require(
                    globNew <= globalDailyETHLimit,
                    "Policy: ETH global cap"
                );
                globalEthSpent[day] = globNew;
            }
        }

        // Calldata-aware gating
        if (data.length >= 4) {
            bytes4 sel = bytes4(data[:4]);
            // Token-call shape (transfer / approve / transferFrom)
            if (
                sel == SEL_TRANSFER ||
                sel == SEL_TRANSFER_FROM ||
                sel == SEL_APPROVE
            ) {
                require(
                    _isAllowedToken(p, to),
                    "Policy: token not allowed"
                );
                if (sel == SEL_APPROVE) {
                    _enforceApprove(p, to, data);
                } else if (sel == SEL_TRANSFER) {
                    require(data.length >= 68, "Policy: bad transfer");
                    uint256 amt = uint256(bytes32(data[36:68]));
                    _chargeToken(p, to, amt);
                } else {
                    // transferFrom — only meaningful if iWallet has allowance
                    // from a third party. Treat as a token spend if `from`
                    // is iWallet.
                    require(data.length >= 100, "Policy: bad transferFrom");
                    address from = address(
                        uint160(uint256(bytes32(data[4:36])))
                    );
                    if (from == address(this)) {
                        uint256 amt = uint256(bytes32(data[68:100]));
                        _chargeToken(p, to, amt);
                    }
                }
                return;
            }
        }

        // Generic contract call → must be in allowedContracts
        require(
            _isAllowedContract(p, to),
            "Policy: contract not allowed"
        );
    }

    function _enforceApprove(
        Policy storage p,
        address token,
        bytes calldata data
    ) internal {
        require(data.length >= 68, "Policy: bad approve");
        address spender = address(uint160(uint256(bytes32(data[4:36]))));
        uint256 amount = uint256(bytes32(data[36:68]));
        require(amount != type(uint256).max, "Policy: no infinite approve");
        require(_isAllowedSpender(p, spender), "Policy: spender not allowed");
        // approval counts toward token daily cap
        _chargeToken(p, token, amount);
    }

    function _chargeToken(
        Policy storage p,
        address token,
        uint256 amount
    ) internal {
        uint256 cap = _tokenLimit(p, token);
        require(cap != 0, "Policy: token cap zero");
        uint256 day = _currentDay();
        uint256 sessNew = sessionTokenSpent[day][msg.sender][token] + amount;
        require(sessNew <= cap, "Policy: token session cap");
        sessionTokenSpent[day][msg.sender][token] = sessNew;

        uint256 gcap = globalTokenDailyLimit[token];
        if (gcap != 0) {
            uint256 globNew = globalTokenSpent[day][token] + amount;
            require(globNew <= gcap, "Policy: token global cap");
            globalTokenSpent[day][token] = globNew;
        }
    }

    function _tokenLimit(
        Policy storage p,
        address token
    ) internal view returns (uint256) {
        for (uint256 i = 0; i < p.allowedTokens.length; i++) {
            if (p.allowedTokens[i] == token) return p.tokenDailyLimits[i];
        }
        return 0;
    }

    function _isAllowedToken(
        Policy storage p,
        address token
    ) internal view returns (bool) {
        for (uint256 i = 0; i < p.allowedTokens.length; i++) {
            if (p.allowedTokens[i] == token) return true;
        }
        return false;
    }

    /// @dev Empty `allowedContracts` means "any target allowed" — the
    ///      daily ETH cap is the only constraint on native spending.
    ///      To narrow, populate the list explicitly.
    function _isAllowedContract(
        Policy storage p,
        address target
    ) internal view returns (bool) {
        if (p.allowedContracts.length == 0) return true;
        for (uint256 i = 0; i < p.allowedContracts.length; i++) {
            if (p.allowedContracts[i] == target) return true;
        }
        return false;
    }

    function _isAllowedSpender(
        Policy storage p,
        address spender
    ) internal view returns (bool) {
        for (uint256 i = 0; i < p.allowedSpenders.length; i++) {
            if (p.allowedSpenders[i] == spender) return true;
        }
        return false;
    }

    function _writePolicy(Policy storage p, Policy calldata src) internal {
        p.dailyETHLimit = src.dailyETHLimit;
        delete p.allowedTokens;
        delete p.tokenDailyLimits;
        for (uint256 i = 0; i < src.allowedTokens.length; i++) {
            p.allowedTokens.push(src.allowedTokens[i]);
            p.tokenDailyLimits.push(src.tokenDailyLimits[i]);
        }
        delete p.allowedContracts;
        for (uint256 i = 0; i < src.allowedContracts.length; i++) {
            p.allowedContracts.push(src.allowedContracts[i]);
        }
        delete p.allowedSpenders;
        for (uint256 i = 0; i < src.allowedSpenders.length; i++) {
            p.allowedSpenders.push(src.allowedSpenders[i]);
        }
        p.cooldownSeconds = src.cooldownSeconds;
        p.maxGasPerTx = src.maxGasPerTx;
        p.expiresAt = src.expiresAt;
    }

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 86400;
    }
}
