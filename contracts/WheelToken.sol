// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title WheelToken
 * @notice ERC7984-like confidential token for the Fortune Wheel game
 * @dev All balances are encrypted using FHE - only token holders can see their own balance
 */
contract WheelToken is ZamaEthereumConfig {
    string public name = "Wheel Token";
    string public symbol = "WHEEL";
    uint8 public decimals = 18;

    // Owner of the contract (can mint tokens)
    address public owner;

    // Encrypted balances for each user
    mapping(address => euint64) private _balances;

    // Encrypted total supply
    euint64 private _totalSupply;

    // Token price in wei (for purchasing tokens)
    uint256 public tokenPrice = 0.001 ether;

    // Operators (addresses that can transfer on behalf of holder)
    mapping(address => mapping(address => bool)) private _operators;

    // Events
    event Transfer(address indexed from, address indexed to);
    event Mint(address indexed to);
    event Burn(address indexed from);
    event OperatorSet(address indexed holder, address indexed operator, bool approved);
    event TokensPurchased(address indexed buyer, uint256 ethAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "WheelToken: caller is not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        _totalSupply = FHE.asEuint64(0);
        FHE.allowThis(_totalSupply);
    }

    /**
     * @notice Get the encrypted balance of an account
     * @param account The address to query
     * @return The encrypted balance (only decryptable by the account holder)
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Get the encrypted total supply
     * @return The encrypted total supply
     */
    function confidentialTotalSupply() external view returns (euint64) {
        return _totalSupply;
    }

    /**
     * @notice Purchase tokens with ETH
     */
    function buyTokens() external payable {
        require(msg.value >= tokenPrice, "WheelToken: insufficient ETH");

        // Calculate token amount - simplified to avoid overflow
        // 0.001 ETH = 1 token (1e18 smallest units)
        uint256 tokensToMint = msg.value / tokenPrice;
        require(tokensToMint <= type(uint64).max / 1e18, "WheelToken: amount too large");
        uint64 tokenAmount = uint64(tokensToMint * 1e18);

        euint64 encryptedAmount = FHE.asEuint64(tokenAmount);

        // Add to balance
        _balances[msg.sender] = FHE.add(_balances[msg.sender], encryptedAmount);
        _totalSupply = FHE.add(_totalSupply, encryptedAmount);

        // Set ACL permissions
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_totalSupply);

        emit TokensPurchased(msg.sender, msg.value);
        emit Mint(msg.sender);
    }

    /**
     * @notice Mint tokens to an address (owner only)
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount to mint
     * @param inputProof Proof for the encrypted input
     */
    function mint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _balances[to] = FHE.add(_balances[to], amount);
        _totalSupply = FHE.add(_totalSupply, amount);

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        FHE.allowThis(_totalSupply);

        emit Mint(to);
    }

    /**
     * @notice Mint a fixed amount of tokens (faucet for testing)
     * @param to Recipient address
     * @param amount Plaintext amount to mint
     */
    function mintPlain(address to, uint64 amount) external onlyOwner {
        euint64 encryptedAmount = FHE.asEuint64(amount);

        _balances[to] = FHE.add(_balances[to], encryptedAmount);
        _totalSupply = FHE.add(_totalSupply, encryptedAmount);

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);
        FHE.allowThis(_totalSupply);

        emit Mint(to);
    }

    /**
     * @notice Transfer tokens confidentially
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount to transfer
     * @param inputProof Proof for the encrypted input
     * @return transferred The encrypted amount actually transferred
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64 transferred) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(msg.sender, to, amount);
    }

    /**
     * @notice Transfer tokens from another address (requires operator approval)
     * @param from Source address
     * @param to Recipient address
     * @param amount Encrypted amount to transfer
     * @return transferred The encrypted amount actually transferred
     */
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64 transferred) {
        require(_operators[from][msg.sender], "WheelToken: caller is not operator");
        return _transfer(from, to, amount);
    }

    /**
     * @notice Internal transfer function
     */
    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal returns (euint64 transferred) {
        require(to != address(0), "WheelToken: transfer to zero address");

        euint64 senderBalance = _balances[from];

        // Check if sender has enough balance
        ebool hasEnough = FHE.ge(senderBalance, amount);

        // Calculate transfer amount (0 if insufficient balance)
        euint64 zero = FHE.asEuint64(0);
        euint64 transferAmount = FHE.select(hasEnough, amount, zero);

        // Update balances
        _balances[from] = FHE.sub(senderBalance, transferAmount);
        _balances[to] = FHE.add(_balances[to], transferAmount);

        // Update ACL for sender
        FHE.allowThis(_balances[from]);
        FHE.allow(_balances[from], from);

        // Update ACL for recipient
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit Transfer(from, to);

        return transferAmount;
    }

    /**
     * @notice Set operator status for an address
     * @param operator The operator address
     * @param approved Whether to approve or revoke
     */
    function setOperator(address operator, bool approved) external {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    /**
     * @notice Check if an address is an operator for a holder
     */
    function isOperator(address holder, address operator) external view returns (bool) {
        return _operators[holder][operator];
    }

    /**
     * @notice Internal function for game contract to transfer tokens
     * @dev Only callable by approved game contracts
     */
    function gameTransfer(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64) {
        require(_operators[from][msg.sender], "WheelToken: caller is not operator");
        return _transfer(from, to, amount);
    }

    /**
     * @notice Withdraw ETH from contract (owner only)
     */
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    /**
     * @notice Set token price (owner only)
     */
    function setTokenPrice(uint256 newPrice) external onlyOwner {
        tokenPrice = newPrice;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WheelToken: new owner is zero address");
        owner = newOwner;
    }
}
