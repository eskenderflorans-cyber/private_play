# Fortune Wheel - Private Prize Game on Zama FHEVM

A fully private fortune wheel game built on Zama Protocol. All bets, outcomes, and winnings are encrypted using Fully Homomorphic Encryption (FHE) - only you can see your own data.

## Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| WheelToken | `0x7748BF440A3914EB44d21B8eDE90CcE9B56274bA` |
| FortuneWheel | `0x6ec63C44412d7E7417fC68ADcA3c3b96B5a8D45D` |

## Quick Start

```bash
# Install dependencies
npm install
cd frontend && npm install

# Run frontend
npm run dev
```

Open http://localhost:5173 and connect MetaMask (Sepolia network).

## How to Play

1. **Connect Wallet** - Use MetaMask on Sepolia testnet
2. **Buy Tokens** - Exchange Sepolia ETH for WHEEL tokens (0.001 ETH = 1 token)
3. **Approve Game** - Allow the game contract to transfer tokens
4. **Spin** - Place your bet and spin the wheel
5. **Reveal Result** - Decrypt your encrypted result
6. **Claim Prize** - Collect your winnings

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

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24, Zama FHEVM
- **Frontend**: React 18, Vite, ethers.js
- **Encryption**: @zama-fhe/relayer-sdk

## License

MIT
