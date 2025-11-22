// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title WheelToken
 * @notice Confidential fungible token for the Fortune Wheel game
 * @dev Implements proper ACL patterns from OpenZeppelin's ConfidentialFungibleToken
 */
contract WheelToken is ZamaEthereumConfig {
    string public name = "Wheel Token";
    string public symbol = "WHEEL";
    uint8 public constant decimals = 6;

    address public owner;

    // Encrypted balances
    mapping(address => euint64) private _balances;

    // Encrypted total supply
    euint64 private _totalSupply;

    // Operator approvals: holder => operator => expiration timestamp
    mapping(address => mapping(address => uint48)) private _operators;

    // Token price in wei (for purchasing tokens)
    uint256 public tokenPrice = 0.001 ether;

    // Events
    event ConfidentialTransfer(address indexed from, address indexed to, euint64 indexed amount);
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    // Errors
    error OnlyOwner();
    error ZeroAddress();
    error InsufficientETH();
    error AmountTooLarge();
    error UnauthorizedSpender(address holder, address spender);
    error UnauthorizedUseOfEncryptedAmount(euint64 amount, address user);
    error ZeroBalance(address holder);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Get confidential balance handle for an account
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Get confidential total supply handle
     */
    function confidentialTotalSupply() external view returns (euint64) {
        return _totalSupply;
    }

    /**
     * @notice Check if spender is an operator for holder
     */
    function isOperator(address holder, address spender) public view returns (bool) {
        return holder == spender || block.timestamp <= _operators[holder][spender];
    }

    /**
     * @notice Set operator approval with expiration timestamp
     */
    function setOperator(address operator, uint48 until) external {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    /**
     * @notice Purchase tokens with ETH
     */
    function buyTokens() external payable {
        if (msg.value < tokenPrice) revert InsufficientETH();
        uint256 ethUnits = msg.value / tokenPrice;
        uint256 tokensInSmallestUnit = ethUnits * 100000 * (10 ** decimals);
        if (tokensInSmallestUnit > type(uint64).max) revert AmountTooLarge();

        euint64 encryptedAmount = FHE.asEuint64(uint64(tokensInSmallestUnit));
        FHE.allowThis(encryptedAmount);
        _mint(msg.sender, encryptedAmount);
    }

    /**
     * @notice Mint tokens with encrypted amount (owner only)
     */
    function mint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _mint(to, amount);
    }

    /**
     * @notice Mint a fixed plaintext amount (owner only, for testing)
     */
    function mintPlain(address to, uint64 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmount);
        _mint(to, encryptedAmount);
    }

    /**
     * @notice Transfer tokens (external encrypted input)
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        return _transfer(msg.sender, to, FHE.fromExternal(encryptedAmount, inputProof));
    }

    /**
     * @notice Transfer tokens (internal handle - caller must have ACL)
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64) {
        if (!FHE.isAllowed(amount, msg.sender)) {
            revert UnauthorizedUseOfEncryptedAmount(amount, msg.sender);
        }
        return _transfer(msg.sender, to, amount);
    }

    /**
     * @notice Transfer from with external encrypted input
     */
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        if (!isOperator(from, msg.sender)) revert UnauthorizedSpender(from, msg.sender);
        euint64 transferred = _transfer(from, to, FHE.fromExternal(encryptedAmount, inputProof));
        FHE.allowTransient(transferred, msg.sender);
        return transferred;
    }

    /**
     * @notice Transfer from with internal handle (for game contracts)
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64) {
        if (!FHE.isAllowed(amount, msg.sender)) {
            revert UnauthorizedUseOfEncryptedAmount(amount, msg.sender);
        }
        if (!isOperator(from, msg.sender)) revert UnauthorizedSpender(from, msg.sender);
        euint64 transferred = _transfer(from, to, amount);
        FHE.allowTransient(transferred, msg.sender);
        return transferred;
    }

    /**
     * @notice Transfer from with plaintext amount (for game contracts)
     * @dev Avoids cross-contract ACL complexity by accepting plaintext
     */
    function transferFromPlain(
        address from,
        address to,
        uint64 amount
    ) external returns (bool) {
        if (!isOperator(from, msg.sender)) revert UnauthorizedSpender(from, msg.sender);

        // Encrypt the plaintext amount internally
        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmount);

        // Perform transfer
        _transfer(from, to, encryptedAmount);
        return true;
    }

    /**
     * @notice Internal mint with proper ACL
     */
    function _mint(address to, euint64 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        // Update total supply
        euint64 newTotalSupply = FHE.add(_totalSupply, amount);
        FHE.allowThis(newTotalSupply);
        _totalSupply = newTotalSupply;

        // Update recipient balance
        euint64 newBalance = FHE.add(_balances[to], amount);
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, to);
        _balances[to] = newBalance;

        emit ConfidentialTransfer(address(0), to, amount);
    }

    /**
     * @notice Internal transfer with proper ACL
     */
    function _transfer(address from, address to, euint64 amount) internal returns (euint64) {
        if (from == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();

        euint64 fromBalance = _balances[from];
        if (!FHE.isInitialized(fromBalance)) revert ZeroBalance(from);

        // Safe subtraction: transferred = min(amount, balance)
        ebool hasEnough = FHE.ge(fromBalance, amount);
        euint64 transferred = FHE.select(hasEnough, amount, fromBalance);

        // Update sender balance
        euint64 newFromBalance = FHE.sub(fromBalance, transferred);
        FHE.allowThis(newFromBalance);
        FHE.allow(newFromBalance, from);
        _balances[from] = newFromBalance;

        // Update recipient balance
        euint64 newToBalance = FHE.add(_balances[to], transferred);
        FHE.allowThis(newToBalance);
        FHE.allow(newToBalance, to);
        _balances[to] = newToBalance;

        // Grant ACL permissions for the transferred amount
        FHE.allowThis(transferred);
        FHE.allow(transferred, from);
        FHE.allow(transferred, to);

        emit ConfidentialTransfer(from, to, transferred);
        return transferred;
    }

    /**
     * @notice Burn tokens
     */
    function burn(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _burn(msg.sender, amount);
    }

    /**
     * @notice Internal burn with proper ACL
     */
    function _burn(address from, euint64 amount) internal {
        if (from == address(0)) revert ZeroAddress();

        euint64 fromBalance = _balances[from];
        if (!FHE.isInitialized(fromBalance)) revert ZeroBalance(from);

        // Safe subtraction
        ebool hasEnough = FHE.ge(fromBalance, amount);
        euint64 burned = FHE.select(hasEnough, amount, fromBalance);

        // Update balance
        euint64 newBalance = FHE.sub(fromBalance, burned);
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, from);
        _balances[from] = newBalance;

        // Update total supply
        euint64 newTotalSupply = FHE.sub(_totalSupply, burned);
        FHE.allowThis(newTotalSupply);
        _totalSupply = newTotalSupply;

        emit ConfidentialTransfer(from, address(0), burned);
    }

    // Admin functions

    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function setTokenPrice(uint256 newPrice) external onlyOwner {
        tokenPrice = newPrice;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
