import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useEncrypt } from "./useEncrypt";
import { useDecrypt } from "./useDecrypt";

// Contract ABIs (simplified)
const WHEEL_TOKEN_ABI = [
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function buyTokens() payable",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address operator) view returns (bool)",
  "function tokenPrice() view returns (uint256)",
];

const FORTUNE_WHEEL_ABI = [
  "function spin(uint64 betAmount)",
  "function revealSegment(uint8 segment)",
  "function claimPrize()",
  "function getSpinResult(address player) view returns (uint64 betAmount, bytes32 segment, bool hasPending, bool isRevealed, uint8 revealedSegment)",
  "function getLastBet(address player) view returns (uint64)",
  "function getSegmentHandle(address player) view returns (bytes32)",
  "function hasPendingSpin(address player) view returns (bool)",
  "function totalSpins() view returns (uint256)",
  "function minBet() view returns (uint64)",
  "function maxBet() view returns (uint64)",
  "event SpinStarted(address indexed player, uint256 spinId)",
  "event SpinCompleted(address indexed player, uint256 spinId)",
  "event PrizeClaimed(address indexed player)",
];

// Prize segment info
export const PRIZE_SEGMENTS = [
  { segment: 0, multiplier: 0, label: "0x", color: "#e74c3c" },
  { segment: 1, multiplier: 1, label: "1x", color: "#3498db" },
  { segment: 2, multiplier: 2, label: "2x", color: "#2ecc71" },
  { segment: 3, multiplier: 3, label: "3x", color: "#9b59b6" },
  { segment: 4, multiplier: 5, label: "5x", color: "#f39c12" },
  { segment: 5, multiplier: 10, label: "10x", color: "#1abc9c" },
  { segment: 6, multiplier: 25, label: "25x", color: "#e91e63" },
  { segment: 7, multiplier: 100, label: "100x", color: "#ffd700" },
];

export interface SpinResult {
  segment: number | null;
  winnings: bigint | null;
  betAmount: bigint | null;
  isDecrypted: boolean;
}

export function useFortuneWheel(
  wheelTokenAddress: string,
  fortuneWheelAddress: string,
  signer: ethers.Signer | null,
  userAddress: string
) {
  const { encrypt64, isEncrypting } = useEncrypt();
  const { decryptSingle, isDecrypting } = useDecrypt();

  const [wheelTokenContract, setWheelTokenContract] = useState<ethers.Contract | null>(null);
  const [fortuneWheelContract, setFortuneWheelContract] = useState<ethers.Contract | null>(null);

  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceHandle, setBalanceHandle] = useState<string | null>(null);
  const [hasPendingSpin, setHasPendingSpin] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult>({
    segment: null,
    winnings: null,
    betAmount: null,
    isDecrypted: false,
  });
  const [isOperatorSet, setIsOperatorSet] = useState(false);

  const [isSpinning, setIsSpinning] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize contracts
  useEffect(() => {
    if (!signer || !wheelTokenAddress || !fortuneWheelAddress) return;

    const wheelToken = new ethers.Contract(wheelTokenAddress, WHEEL_TOKEN_ABI, signer);
    const fortuneWheel = new ethers.Contract(fortuneWheelAddress, FORTUNE_WHEEL_ABI, signer);

    setWheelTokenContract(wheelToken);
    setFortuneWheelContract(fortuneWheel);
  }, [signer, wheelTokenAddress, fortuneWheelAddress]);

  // Check operator status
  useEffect(() => {
    if (!wheelTokenContract || !userAddress || !fortuneWheelAddress) return;

    const checkOperator = async () => {
      try {
        const isOp = await wheelTokenContract.isOperator(userAddress, fortuneWheelAddress);
        setIsOperatorSet(isOp);
      } catch (err) {
        console.error("Error checking operator:", err);
      }
    };

    checkOperator();
  }, [wheelTokenContract, userAddress, fortuneWheelAddress]);

  // Check pending spin status
  useEffect(() => {
    if (!fortuneWheelContract || !userAddress) return;

    const checkPendingSpin = async () => {
      try {
        const pending = await fortuneWheelContract.hasPendingSpin(userAddress);
        setHasPendingSpin(pending);
      } catch (err) {
        console.error("Error checking pending spin:", err);
      }
    };

    checkPendingSpin();
  }, [fortuneWheelContract, userAddress]);

  // Fetch balance handle
  const fetchBalance = useCallback(async () => {
    if (!wheelTokenContract || !userAddress) return;

    try {
      const handle = await wheelTokenContract.confidentialBalanceOf(userAddress);
      setBalanceHandle(handle.toString());
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  }, [wheelTokenContract, userAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Decrypt balance
  const decryptBalance = useCallback(async () => {
    if (!balanceHandle || !signer || !userAddress || !wheelTokenAddress) return;

    try {
      const decrypted = await decryptSingle(
        balanceHandle,
        wheelTokenAddress,
        signer,
        userAddress
      );
      if (decrypted !== null) {
        setBalance(decrypted);
      }
    } catch (err) {
      console.error("Error decrypting balance:", err);
    }
  }, [balanceHandle, signer, userAddress, wheelTokenAddress, decryptSingle]);

  // Set operator
  const setOperator = useCallback(async () => {
    if (!wheelTokenContract || !fortuneWheelAddress) return;

    try {
      // Set expiration to 1 year from now (uint48 timestamp)
      const oneYear = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      const tx = await wheelTokenContract.setOperator(fortuneWheelAddress, oneYear);
      await tx.wait();
      setIsOperatorSet(true);
    } catch (err) {
      console.error("Error setting operator:", err);
      setError(err instanceof Error ? err.message : "Failed to set operator");
    }
  }, [wheelTokenContract, fortuneWheelAddress]);

  // Buy tokens
  const buyTokens = useCallback(async (ethAmount: string) => {
    if (!wheelTokenContract) return;

    setIsBuying(true);
    setError(null);

    try {
      const tx = await wheelTokenContract.buyTokens({
        value: ethers.parseEther(ethAmount),
      });
      await tx.wait();
      await fetchBalance();
    } catch (err) {
      console.error("Error buying tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to buy tokens");
    } finally {
      setIsBuying(false);
    }
  }, [wheelTokenContract, fetchBalance]);

  // Spin the wheel
  const spin = useCallback(async (betAmount: bigint) => {
    if (!fortuneWheelContract || !userAddress || !fortuneWheelAddress) {
      setError("Contracts not initialized");
      return;
    }

    if (!isOperatorSet) {
      setError("Please approve the game contract first");
      return;
    }

    setIsSpinning(true);
    setError(null);
    setSpinResult({ segment: null, winnings: null, betAmount: null, isDecrypted: false });

    try {
      console.log("Spin parameters:", {
        betAmount: betAmount.toString(),
      });

      // Call spin function with plaintext bet amount (hybrid approach)
      const tx = await fortuneWheelContract.spin(betAmount, { gasLimit: 2000000n });
      console.log("Transaction submitted:", tx.hash);

      await tx.wait();
      console.log("Transaction confirmed");

      setHasPendingSpin(true);
      await fetchBalance();
    } catch (err: unknown) {
      console.error("Error spinning:", err);
      // Extract more detailed error info
      let errorMessage = "Failed to spin";
      if (err instanceof Error) {
        errorMessage = err.message;
        // Check for revert reason
        if ('reason' in err) {
          errorMessage = (err as { reason: string }).reason || errorMessage;
        }
        if ('data' in err) {
          console.error("Error data:", (err as { data: unknown }).data);
        }
      }
      setError(errorMessage);
    } finally {
      setIsSpinning(false);
    }
  }, [fortuneWheelContract, userAddress, fortuneWheelAddress, isOperatorSet, fetchBalance]);

  // Fetch and decrypt spin result
  const fetchSpinResult = useCallback(async () => {
    if (!fortuneWheelContract || !userAddress || !signer || !fortuneWheelAddress) return;

    try {
      // New contract interface: (betAmount, segment, hasPending, isRevealed, revealedSegment)
      const result = await fortuneWheelContract.getSpinResult(userAddress);
      const betAmount = result[0]; // uint64 plaintext
      const segmentHandle = result[1]; // euint8 encrypted
      const pending = result[2]; // bool
      const isRevealed = result[3]; // bool
      const revealedSegment = result[4]; // uint8

      if (!pending) {
        setHasPendingSpin(false);
        return;
      }

      // If already revealed, use the revealed segment
      if (isRevealed) {
        const multiplier = PRIZE_SEGMENTS[Number(revealedSegment)]?.multiplier || 0;
        // multiplier is 0, 1, 2, 3, 5, 10, 25, 100 - just multiply directly
        const winnings = BigInt(betAmount) * BigInt(multiplier);

        setSpinResult({
          segment: Number(revealedSegment),
          winnings: winnings,
          betAmount: BigInt(betAmount),
          isDecrypted: true,
        });
        return;
      }

      // Decrypt segment (8-bit) from encrypted handle
      const segmentDecrypted = await decryptSingle(
        segmentHandle.toString(),
        fortuneWheelAddress,
        signer,
        userAddress
      );

      if (segmentDecrypted !== null) {
        const segment = Number(segmentDecrypted);
        const multiplier = PRIZE_SEGMENTS[segment]?.multiplier || 0;
        // multiplier is 0, 1, 2, 3, 5, 10, 25, 100 - just multiply directly
        const winnings = BigInt(betAmount) * BigInt(multiplier);

        setSpinResult({
          segment: segment,
          winnings: winnings,
          betAmount: BigInt(betAmount),
          isDecrypted: true,
        });
      }
    } catch (err) {
      console.error("Error fetching spin result:", err);
    }
  }, [fortuneWheelContract, userAddress, signer, fortuneWheelAddress, decryptSingle]);

  // Claim prize (first reveal segment, then claim)
  const claimPrize = useCallback(async () => {
    if (!fortuneWheelContract || !spinResult.isDecrypted || spinResult.segment === null) {
      setError("Please decrypt your result first");
      return;
    }

    setIsClaiming(true);
    setError(null);

    try {
      // Check if already revealed
      const result = await fortuneWheelContract.getSpinResult(userAddress);
      const isRevealed = result[3];

      // First reveal the segment if not already revealed
      if (!isRevealed) {
        console.log("Revealing segment:", spinResult.segment);
        const revealTx = await fortuneWheelContract.revealSegment(spinResult.segment);
        await revealTx.wait();
        console.log("Segment revealed");
      }

      // Then claim the prize
      console.log("Claiming prize...");
      const claimTx = await fortuneWheelContract.claimPrize();
      await claimTx.wait();
      console.log("Prize claimed");

      setHasPendingSpin(false);
      setSpinResult({ segment: null, winnings: null, betAmount: null, isDecrypted: false });
      await fetchBalance();
    } catch (err) {
      console.error("Error claiming prize:", err);
      setError(err instanceof Error ? err.message : "Failed to claim prize");
    } finally {
      setIsClaiming(false);
    }
  }, [fortuneWheelContract, fetchBalance, spinResult, userAddress]);

  return {
    // State
    balance,
    balanceHandle,
    hasPendingSpin,
    spinResult,
    isOperatorSet,
    error,

    // Loading states
    isSpinning,
    isClaiming,
    isBuying,
    isEncrypting,
    isDecrypting,

    // Actions
    buyTokens,
    setOperator,
    spin,
    claimPrize,
    decryptBalance,
    fetchSpinResult,
    fetchBalance,
  };
}
