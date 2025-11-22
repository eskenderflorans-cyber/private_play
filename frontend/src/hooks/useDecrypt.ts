import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { getFheInstance } from "../core/fhevm";

interface HandleInfo {
  handle: string;
  contractAddress: string;
}

export function useDecrypt() {
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decrypt = useCallback(async (
    handles: HandleInfo[],
    signer: ethers.Signer,
    userAddress: string,
    contractAddresses: string[]
  ): Promise<Map<string, bigint>> => {
    const instance = getFheInstance();
    if (!instance) {
      setError("FHEVM not initialized");
      return new Map();
    }

    setIsDecrypting(true);
    setError(null);

    try {
      // Generate keypair for decryption
      const keypair = instance.generateKeypair();

      // Set up EIP-712 parameters
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 7;

      // Create EIP-712 message
      const eip712Message = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );

      // Sign the message
      const signature = await signer.signTypedData(
        eip712Message.domain,
        eip712Message.types,
        eip712Message.message
      );

      // Decrypt the values
      const results = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimestamp,
        durationDays
      );

      // Convert results to Map
      const resultMap = new Map<string, bigint>();
      for (const [handle, value] of Object.entries(results)) {
        resultMap.set(handle, BigInt(value as string | number));
      }

      return resultMap;
    } catch (err) {
      console.error("Decryption error:", err);
      setError(err instanceof Error ? err.message : String(err));
      return new Map();
    } finally {
      setIsDecrypting(false);
    }
  }, []);

  const decryptSingle = useCallback(async (
    handle: string,
    contractAddress: string,
    signer: ethers.Signer,
    userAddress: string
  ): Promise<bigint | null> => {
    const results = await decrypt(
      [{ handle, contractAddress }],
      signer,
      userAddress,
      [contractAddress]
    );
    return results.get(handle) ?? null;
  }, [decrypt]);

  return {
    decrypt,
    decryptSingle,
    isDecrypting,
    error,
  };
}
