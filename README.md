# Fortune Wheel - Private Prize Game on Zama FHEVM

A fortune wheel game built on Zama Protocol using Fully Homomorphic Encryption (FHE). Token balances are encrypted and game outcomes are private until you reveal them.

## Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| WheelToken | `0x401D82f4Ffd850e355989359D8a7b6e858bC18ca` |
| FortuneWheel | `0x480Ec1111e8A66EeF6a74122aF092AE56e582Ce3` |

![Screenshot_2](https://github.com/user-attachments/assets/29848f43-256f-4c18-a51d-1d71cdea4098)


## Architecture

**Hybrid Privacy Model:**
- Token balances: **Encrypted** (private)
- Random segment: **Encrypted** until reveal (private)
- Bet amounts: **Plaintext** (public)

This hybrid approach avoids cross-contract FHE ACL complexity while maintaining meaningful privacy.

## Quick Start

```bash
# Install dependencies
npm install
cd frontend && npm install
npm run dev
```

Open http://localhost:5173 and connect MetaMask (Sepolia network).

## How to Play

1. **Connect Wallet** - Use MetaMask on Sepolia testnet
2. **Buy Tokens** - Exchange Sepolia ETH for WHEEL tokens (0.001 ETH = 100,000 tokens)
3. **Set Operator** - Allow the game contract to transfer tokens on your behalf
4. **Spin** - Place your bet (plaintext amount) and spin the wheel
5. **Reveal Result** - Decrypt your encrypted segment client-side and submit it
6. **Claim Prize** - Collect your winnings based on revealed segment

## Game Flow (Technical)

```
Player                          FortuneWheel                    WheelToken
   |                                  |                              |
   |-- spin(betAmount) -------------->|                              |
   |                                  |-- transferFromPlain() ------>|
   |                                  |<-- tokens transferred -------|
   |                                  |                              |
   |                                  |-- FHE.randEuint8() --------->|
   |                                  |   (encrypted segment)        |
   |<-- segment handle ---------------|                              |
   |                                  |                              |
   |   [decrypt segment off-chain]    |                              |
   |                                  |                              |
   |-- revealSegment(segment) ------->|                              |
   |                                  |                              |
   |-- claimPrize() ----------------->|                              |
   |                                  |-- transferFromPlain() ------>|
   |<-- winnings --------------------- |<-- tokens transferred ------|
```

## Prize Segments

| Segment | Multiplier | Probability |
|---------|------------|-------------|
| 0 | 0x (lose) | ~25% |
| 1 | 1x | ~20% |
| 2 | 2x | ~20% |
| 3 | 3x | ~15% |
| 4 | 5x | ~10% |
| 5 | 10x | ~5% |
| 6 | 25x | ~3% |
| 7 | 100x | ~2% |

## Contracts

### WheelToken
Confidential ERC20-like token with encrypted balances.

Key functions:
- `confidentialBalanceOf(address)` - Returns encrypted balance handle
- `setOperator(address, uint48)` - Approve operator with expiration timestamp
- `transferFromPlain(from, to, amount)` - Transfer with plaintext amount (for games)
- `confidentialTransfer(to, amount, proof)` - Transfer with encrypted amount

### FortuneWheel
The game contract with encrypted random outcomes.

Key functions:
- `spin(uint64 betAmount)` - Place bet and spin (plaintext bet)
- `revealSegment(uint8 segment)` - Submit decrypted segment
- `claimPrize()` - Claim winnings after reveal
- `getSegmentHandle(address)` - Get encrypted segment for decryption

## Development

```bash
# Compile contracts
npx hardhat compile

# Deploy fresh contracts
npx hardhat run scripts/deploy-test-fresh.ts --network ethersSepoliaTestnet

# Run tests
npx hardhat test
```

## Environment Variables

Create `.env` file:
```
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

## Tech Stack
- **Smart Contracts**: Solidity 0.8.24, Zama FHEVM 0.9.1, relayer-sdk0.3.0-5, OpenZeppelin confidential-contracts 0.2.0
- **Frontend**: React 18, Vite, ethers.js
- **Encryption**: fhevmjs for client-side decryption
