// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint8, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IWheelToken {
    function confidentialBalanceOf(address account) external view returns (euint64);
    function gameTransfer(address from, address to, euint64 amount) external returns (euint64);
    function setOperator(address operator, bool approved) external;
}

/**
 * @title FortuneWheel
 * @notice Fully private fortune wheel game using FHE
 * @dev All bets, outcomes, and winnings are encrypted - only players can see their own data
 *
 * Prize Segments (8 slots):
 * 0 = 0x (lose)      - ~25% probability
 * 1 = 1x (break even)- ~20% probability
 * 2 = 2x            - ~20% probability
 * 3 = 3x            - ~15% probability
 * 4 = 5x            - ~10% probability
 * 5 = 10x           - ~5% probability
 * 6 = 25x           - ~3% probability
 * 7 = 100x          - ~2% probability
 */
contract FortuneWheel is ZamaEthereumConfig {
    // Game token
    IWheelToken public wheelToken;

    // Contract owner
    address public owner;

    // House wallet (receives losing bets, pays winning bets)
    address public houseWallet;

    // Minimum and maximum bet amounts
    uint64 public minBet = 1e18; // 1 token
    uint64 public maxBet = 1000e18; // 1000 tokens

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
    // Segment 0: 0-63   (64/256 = 25%)
    // Segment 1: 64-114 (51/256 = 20%)
    // Segment 2: 115-165 (51/256 = 20%)
    // Segment 3: 166-204 (39/256 = 15%)
    // Segment 4: 205-230 (26/256 = 10%)
    // Segment 5: 231-243 (13/256 = 5%)
    // Segment 6: 244-251 (8/256 = 3%)
    // Segment 7: 252-255 (4/256 = 2%)
    uint8[8] public segmentThresholds = [64, 115, 166, 205, 231, 244, 252, 255];

    // Player spin data
    struct SpinData {
        euint64 betAmount;      // Encrypted bet amount
        euint8 segment;         // Encrypted winning segment (0-7)
        euint64 winnings;       // Encrypted winnings
        bool hasPendingSpin;    // Whether player has unclaimed spin
        uint256 spinTimestamp;  // When the spin occurred
    }

    mapping(address => SpinData) private _playerSpins;

    // Total spins counter
    uint256 public totalSpins;

    // Events
    event SpinStarted(address indexed player, uint256 spinId);
    event SpinCompleted(address indexed player, uint256 spinId);
    event PrizeClaimed(address indexed player);

    modifier onlyOwner() {
        require(msg.sender == owner, "FortuneWheel: caller is not owner");
        _;
    }

    constructor(address _wheelToken, address _houseWallet) {
        wheelToken = IWheelToken(_wheelToken);
        houseWallet = _houseWallet;
        owner = msg.sender;
    }

    /**
     * @notice Spin the wheel with an encrypted bet
     * @param encryptedBet Encrypted bet amount
     * @param inputProof Proof for the encrypted input
     */
    function spin(
        externalEuint64 encryptedBet,
        bytes calldata inputProof
    ) external {
        require(!_playerSpins[msg.sender].hasPendingSpin, "FortuneWheel: claim previous spin first");

        // Validate and convert bet
        euint64 betAmount = FHE.fromExternal(encryptedBet, inputProof);

        // Clamp bet to min/max range
        euint64 minBetEnc = FHE.asEuint64(minBet);
        euint64 maxBetEnc = FHE.asEuint64(maxBet);

        // If bet < minBet, use minBet; if bet > maxBet, use maxBet
        ebool belowMin = FHE.lt(betAmount, minBetEnc);
        ebool aboveMax = FHE.gt(betAmount, maxBetEnc);
        betAmount = FHE.select(belowMin, minBetEnc, betAmount);
        betAmount = FHE.select(aboveMax, maxBetEnc, betAmount);

        // Transfer bet from player to house
        euint64 transferred = wheelToken.gameTransfer(msg.sender, houseWallet, betAmount);

        // Generate encrypted random number (0-255)
        euint8 randomValue = FHE.randEuint8();

        // Determine segment based on weighted probability
        euint8 segment = _getSegment(randomValue);

        // Calculate winnings
        euint64 winnings = _calculateWinnings(transferred, segment);

        // Store spin data
        _playerSpins[msg.sender] = SpinData({
            betAmount: transferred,
            segment: segment,
            winnings: winnings,
            hasPendingSpin: true,
            spinTimestamp: block.timestamp
        });

        // Set ACL permissions for player
        FHE.allowThis(_playerSpins[msg.sender].betAmount);
        FHE.allow(_playerSpins[msg.sender].betAmount, msg.sender);

        FHE.allowThis(_playerSpins[msg.sender].segment);
        FHE.allow(_playerSpins[msg.sender].segment, msg.sender);

        FHE.allowThis(_playerSpins[msg.sender].winnings);
        FHE.allow(_playerSpins[msg.sender].winnings, msg.sender);

        totalSpins++;

        emit SpinStarted(msg.sender, totalSpins);
        emit SpinCompleted(msg.sender, totalSpins);
    }

    /**
     * @notice Claim winnings from a spin
     */
    function claimPrize() external {
        require(_playerSpins[msg.sender].hasPendingSpin, "FortuneWheel: no pending spin");

        euint64 winnings = _playerSpins[msg.sender].winnings;

        // Check if winnings > 0
        euint64 zero = FHE.asEuint64(0);
        ebool hasWinnings = FHE.gt(winnings, zero);

        // Transfer winnings from house to player (if any)
        euint64 transferAmount = FHE.select(hasWinnings, winnings, zero);
        wheelToken.gameTransfer(houseWallet, msg.sender, transferAmount);

        // Clear pending spin
        _playerSpins[msg.sender].hasPendingSpin = false;

        emit PrizeClaimed(msg.sender);
    }

    /**
     * @notice Get player's pending spin result (encrypted)
     * @param player Player address
     * @return segment Encrypted segment (0-7)
     * @return winnings Encrypted winnings amount
     * @return hasPending Whether there's a pending spin
     */
    function getSpinResult(address player) external view returns (
        euint8 segment,
        euint64 winnings,
        bool hasPending
    ) {
        SpinData storage data = _playerSpins[player];
        return (data.segment, data.winnings, data.hasPendingSpin);
    }

    /**
     * @notice Get player's last bet amount (encrypted)
     */
    function getLastBet(address player) external view returns (euint64) {
        return _playerSpins[player].betAmount;
    }

    /**
     * @notice Check if player has pending spin
     */
    function hasPendingSpin(address player) external view returns (bool) {
        return _playerSpins[player].hasPendingSpin;
    }

    /**
     * @notice Determine segment from random value using weighted probability
     * @param randomValue Random uint8 (0-255)
     * @return segment The winning segment (0-7)
     */
    function _getSegment(euint8 randomValue) internal returns (euint8) {
        // Start with segment 0
        euint8 segment = FHE.asEuint8(0);

        // Check each threshold and update segment
        // If random >= threshold[i], segment = i + 1
        for (uint8 i = 0; i < 7; i++) {
            euint8 threshold = FHE.asEuint8(segmentThresholds[i]);
            ebool aboveThreshold = FHE.ge(randomValue, threshold);
            euint8 nextSegment = FHE.asEuint8(i + 1);
            segment = FHE.select(aboveThreshold, nextSegment, segment);
        }

        FHE.allowThis(segment);
        return segment;
    }

    /**
     * @notice Calculate winnings based on bet and segment
     * @param bet The bet amount
     * @param segment The winning segment
     * @return winnings The calculated winnings
     */
    function _calculateWinnings(euint64 bet, euint8 segment) internal returns (euint64) {
        // Start with 0 winnings
        euint64 winnings = FHE.asEuint64(0);

        // For each possible segment, calculate potential winnings
        // and select if segment matches
        for (uint8 i = 0; i < 8; i++) {
            euint8 segmentValue = FHE.asEuint8(i);
            ebool isThisSegment = FHE.eq(segment, segmentValue);

            // Calculate winnings for this segment: bet * multiplier / 10000
            uint64 multiplier = prizeMultipliers[i];
            euint64 potentialWinnings;

            if (multiplier == 0) {
                potentialWinnings = FHE.asEuint64(0);
            } else {
                // bet * multiplier / 10000
                potentialWinnings = FHE.div(FHE.mul(bet, multiplier), 10000);
            }

            winnings = FHE.select(isThisSegment, potentialWinnings, winnings);
        }

        FHE.allowThis(winnings);
        return winnings;
    }

    // Admin functions

    /**
     * @notice Set minimum bet amount
     */
    function setMinBet(uint64 _minBet) external onlyOwner {
        minBet = _minBet;
    }

    /**
     * @notice Set maximum bet amount
     */
    function setMaxBet(uint64 _maxBet) external onlyOwner {
        maxBet = _maxBet;
    }

    /**
     * @notice Update house wallet
     */
    function setHouseWallet(address _houseWallet) external onlyOwner {
        require(_houseWallet != address(0), "FortuneWheel: zero address");
        houseWallet = _houseWallet;
    }

    /**
     * @notice Update prize multiplier for a segment
     */
    function setPrizeMultiplier(uint8 segment, uint64 multiplier) external onlyOwner {
        require(segment < 8, "FortuneWheel: invalid segment");
        prizeMultipliers[segment] = multiplier;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FortuneWheel: zero address");
        owner = newOwner;
    }
}
