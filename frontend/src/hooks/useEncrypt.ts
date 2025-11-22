import { useState, useCallback } from "react";
import { getFheInstance } from "../core/fhevm";

export interface EncryptedInput {
  handles: string[];
  inputProof: string;
}

export function useEncrypt() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const encrypt64 = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: bigint
  ): Promise<EncryptedInput | null> => {
    const instance = getFheInstance();
    if (!instance) {
      setError("FHEVM not initialized");
      return null;
    }

    setIsEncrypting(true);
    setError(null);

    try {
      const input = instance.createEncryptedInput(contractAddress, userAddress);
      input.add64(value);
      const encrypted = await input.encrypt();
      return {
        handles: encrypted.handles,
        inputProof: encrypted.inputProof,
      };
    } catch (err) {
      console.error("Encryption error:", err);
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsEncrypting(false);
    }
  }, []);

  const encrypt8 = useCallback(async (
    contractAddress: string,
    userAddress: string,
    value: number
  ): Promise<EncryptedInput | null> => {
    const instance = getFheInstance();
    if (!instance) {
      setError("FHEVM not initialized");
      return null;
    }

    setIsEncrypting(true);
    setError(null);

    try {
      const input = instance.createEncryptedInput(contractAddress, userAddress);
      input.add8(value);
      const encrypted = await input.encrypt();
      return {
        handles: encrypted.handles,
        inputProof: encrypted.inputProof,
      };
    } catch (err) {
      console.error("Encryption error:", err);
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsEncrypting(false);
    }
  }, []);

  return {
    encrypt64,
    encrypt8,
    isEncrypting,
    error,
  };
}
