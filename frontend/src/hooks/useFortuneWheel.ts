import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useEncrypt } from "./useEncrypt";
import { useDecrypt } from "./useDecrypt";

// Contract ABIs (simplified)
const WHEEL_TOKEN_ABI = [
  "function confidentialBalanceOf(address account) view returns (bytes32)",
  "function buyTokens() payable",
  "function setOperator(address operator, bool approved)",
  "function isOperator(address holder, address operator) view returns (bool)",
  "function tokenPrice() view returns (uint256)",
];

const FORTUNE_WHEEL_ABI = [
  "function spin(bytes32 encryptedBet, bytes inputProof)",
  "function claimPrize()",
  "function getSpinResult(address player) view returns (bytes32 segment, bytes32 winnings, bool hasPending)",
  "function getLastBet(address player) view returns (bytes32)",
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
      const tx = await wheelTokenContract.setOperator(fortuneWheelAddress, true);
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
      // Normalize addresses to checksummed format
      const normalizedContractAddress = ethers.getAddress(fortuneWheelAddress);
      const normalizedUserAddress = ethers.getAddress(userAddress);

      console.log("Spin parameters:", {
        contractAddress: normalizedContractAddress,
        userAddress: normalizedUserAddress,
        betAmount: betAmount.toString(),
      });

      // Encrypt the bet amount with normalized addresses
      const encrypted = await encrypt64(normalizedContractAddress, normalizedUserAddress, betAmount);
      if (!encrypted) {
        throw new Error("Failed to encrypt bet");
      }

      console.log("Encrypted data:", {
        handle: encrypted.handles[0],
        proofLength: encrypted.inputProof.length,
      });

      // Call spin function
      const tx = await fortuneWheelContract.spin(encrypted.handles[0], encrypted.inputProof);
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
  }, [fortuneWheelContract, userAddress, fortuneWheelAddress, isOperatorSet, encrypt64, fetchBalance]);

  // Fetch and decrypt spin result
  const fetchSpinResult = useCallback(async () => {
    if (!fortuneWheelContract || !userAddress || !signer || !fortuneWheelAddress) return;

    try {
      const [segmentHandle, winningsHandle, pending] = await fortuneWheelContract.getSpinResult(userAddress);
      const betHandle = await fortuneWheelContract.getLastBet(userAddress);

      if (!pending) {
        setHasPendingSpin(false);
        return;
      }

      // Decrypt segment (8-bit)
      const segmentDecrypted = await decryptSingle(
        segmentHandle.toString(),
        fortuneWheelAddress,
        signer,
        userAddress
      );

      // Decrypt winnings (64-bit)
      const winningsDecrypted = await decryptSingle(
        winningsHandle.toString(),
        fortuneWheelAddress,
        signer,
        userAddress
      );

      // Decrypt bet amount
      const betDecrypted = await decryptSingle(
        betHandle.toString(),
        fortuneWheelAddress,
        signer,
        userAddress
      );

      setSpinResult({
        segment: segmentDecrypted !== null ? Number(segmentDecrypted) : null,
        winnings: winningsDecrypted,
        betAmount: betDecrypted,
        isDecrypted: true,
      });
    } catch (err) {
      console.error("Error fetching spin result:", err);
    }
  }, [fortuneWheelContract, userAddress, signer, fortuneWheelAddress, decryptSingle]);

  // Claim prize
  const claimPrize = useCallback(async () => {
    if (!fortuneWheelContract) return;

    setIsClaiming(true);
    setError(null);

    try {
      const tx = await fortuneWheelContract.claimPrize();
      await tx.wait();

      setHasPendingSpin(false);
      setSpinResult({ segment: null, winnings: null, betAmount: null, isDecrypted: false });
      await fetchBalance();
    } catch (err) {
      console.error("Error claiming prize:", err);
      setError(err instanceof Error ? err.message : "Failed to claim prize");
    } finally {
      setIsClaiming(false);
    }
  }, [fortuneWheelContract, fetchBalance]);

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
