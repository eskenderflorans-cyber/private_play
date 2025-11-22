// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint8, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IWheelToken {
    function confidentialBalanceOf(address account) external view returns (euint64);
    function isOperator(address holder, address spender) external view returns (bool);
    function setOperator(address operator, uint48 until) external;
    function transferFromPlain(address from, address to, uint64 amount) external returns (bool);
}

/**
 * @title FortuneWheel
 * @notice Fully private fortune wheel game using FHE
 * @dev Uses WheelToken with proper ACL handling
 */
contract FortuneWheel is ZamaEthereumConfig {
    // Game token
    IWheelToken public wheelToken;

    // Contract owner
    address public owner;

    // House wallet (receives losing bets, pays winning bets)
    address public houseWallet;

    // Minimum and maximum bet amounts (in token units with 6 decimals)
    uint64 public minBet = 1e6; // 1 token
    uint64 public maxBet = 10000e6; // 10,000 tokens

    // Prize multipliers for each segment (in basis points, 10000 = 1x)
    uint64[8] public prizeMultipliers = [
        0,       // Segment 0: 0x (lose)
        10000,   // Segment 1: 1x (break even)
        20000,   // Segment 2: 2x
        30000,   // Segment 3: 3x
        50000,   // Segment 4: 5x
        100000,  // Segment 5: 10x
        250000,  // Segment 6: 25x
        1000000  // Segment 7: 100x
    ];

    // Weighted probability distribution (cumulative, out of 256 for euint8 range)
    uint8[8] public segmentThresholds = [64, 115, 166, 205, 231, 244, 252, 255];

    // Player spin data
    struct SpinData {
        uint64 betAmount;      // Plaintext bet amount
        euint8 segment;        // Encrypted segment (private until reveal)
        uint8 revealedSegment; // Revealed segment (after decryption)
        bool hasPendingSpin;
        bool isRevealed;       // Whether segment has been revealed
        uint256 spinTimestamp;
    }

    mapping(address => SpinData) private _playerSpins;

    uint256 public totalSpins;

    // Events
    event SpinStarted(address indexed player, uint256 spinId);
    event SpinCompleted(address indexed player, uint256 spinId);
    event PrizeClaimed(address indexed player);

    error OnlyOwner();
    error PendingSpinExists();
    error NoPendingSpin();
    error ZeroAddress();
    error InvalidSegment();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _wheelToken, address _houseWallet) {
        wheelToken = IWheelToken(_wheelToken);
        houseWallet = _houseWallet;
        owner = msg.sender;
    }

    /**
     * @notice Spin the wheel with a plaintext bet amount
     * @dev Bet amount is public, but balances remain private in the token
     */
    function spin(uint64 betAmount) external {
        if (_playerSpins[msg.sender].hasPendingSpin) revert PendingSpinExists();

        // Clamp bet to min/max range
        if (betAmount < minBet) betAmount = minBet;
        if (betAmount > maxBet) betAmount = maxBet;

        // Transfer bet from player to house using plaintext transfer
        wheelToken.transferFromPlain(msg.sender, houseWallet, betAmount);

        // Generate encrypted random number (0-255)
        euint8 randomValue = FHE.randEuint8();

        // Determine segment based on weighted probability
        euint8 segment = _getSegment(randomValue);

        // Store spin data (bet is plaintext, segment is encrypted)
        _playerSpins[msg.sender] = SpinData({
            betAmount: betAmount,
            segment: segment,
            revealedSegment: 0,
            hasPendingSpin: true,
            isRevealed: false,
            spinTimestamp: block.timestamp
        });

        // Set ACL permissions for player to decrypt their segment
        FHE.allowThis(segment);
        FHE.allow(segment, msg.sender);

        totalSpins++;

        emit SpinStarted(msg.sender, totalSpins);
        emit SpinCompleted(msg.sender, totalSpins);
    }

    /**
     * @notice Reveal the segment (called by player after decrypting off-chain)
     * @dev Player decrypts segment client-side and submits the revealed value
     */
    function revealSegment(uint8 segment) external {
        if (!_playerSpins[msg.sender].hasPendingSpin) revert NoPendingSpin();
        if (_playerSpins[msg.sender].isRevealed) revert InvalidSegment();
        if (segment >= 8) revert InvalidSegment();

        _playerSpins[msg.sender].revealedSegment = segment;
        _playerSpins[msg.sender].isRevealed = true;
    }

    /**
     * @notice Claim winnings from a revealed spin
     */
    function claimPrize() external {
        SpinData storage playerSpin = _playerSpins[msg.sender];
        if (!playerSpin.hasPendingSpin) revert NoPendingSpin();
        if (!playerSpin.isRevealed) revert NoPendingSpin(); // Must reveal first

        // Calculate winnings from plaintext bet and revealed segment
        uint64 multiplier = prizeMultipliers[playerSpin.revealedSegment];
        uint64 winnings = uint64((uint256(playerSpin.betAmount) * multiplier) / 10000);

        // Transfer winnings from house to player (if any)
        if (winnings > 0) {
            wheelToken.transferFromPlain(houseWallet, msg.sender, winnings);
        }

        // Clear pending spin
        playerSpin.hasPendingSpin = false;

        emit PrizeClaimed(msg.sender);
    }

    /**
     * @notice Get player's pending spin data
     */
    function getSpinResult(address player) external view returns (
        uint64 betAmount,
        euint8 segment,
        bool hasPending,
        bool isRevealed,
        uint8 revealedSegment
    ) {
        SpinData storage data = _playerSpins[player];
        return (data.betAmount, data.segment, data.hasPendingSpin, data.isRevealed, data.revealedSegment);
    }

    /**
     * @notice Get player's last bet amount
     */
    function getLastBet(address player) external view returns (uint64) {
        return _playerSpins[player].betAmount;
    }

    /**
     * @notice Get the encrypted segment handle for off-chain decryption
     */
    function getSegmentHandle(address player) external view returns (euint8) {
        return _playerSpins[player].segment;
    }

    /**
     * @notice Check if player has pending spin
     */
    function hasPendingSpin(address player) external view returns (bool) {
        return _playerSpins[player].hasPendingSpin;
    }

    /**
     * @notice Determine segment from random value using weighted probability
     */
    function _getSegment(euint8 randomValue) internal returns (euint8) {
        euint8 segment = FHE.asEuint8(0);

        for (uint8 i = 0; i < 7; i++) {
            ebool aboveThreshold = FHE.ge(randomValue, segmentThresholds[i]);
            segment = FHE.select(aboveThreshold, FHE.asEuint8(i + 1), segment);
        }

        return segment;
    }

    // Admin functions

    function setMinBet(uint64 _minBet) external onlyOwner {
        minBet = _minBet;
    }

    function setMaxBet(uint64 _maxBet) external onlyOwner {
        maxBet = _maxBet;
    }

    function setHouseWallet(address _houseWallet) external onlyOwner {
        if (_houseWallet == address(0)) revert ZeroAddress();
        houseWallet = _houseWallet;
    }

    function setPrizeMultiplier(uint8 segment, uint64 multiplier) external onlyOwner {
        if (segment >= 8) revert InvalidSegment();
        prizeMultipliers[segment] = multiplier;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
