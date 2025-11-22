import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { getFheInstance } from "../core/fhevm";

export interface EncryptedInput {
  handles: string[];
  inputProof: string;
}

// Convert Uint8Array to hex string
function toHexString(bytes: Uint8Array): string {
  return ethers.hexlify(bytes);
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
      // Verify the user address matches what MetaMask reports
      const accounts = await window.ethereum?.request({ method: 'eth_accounts' }) as string[];
      const activeAccount = accounts?.[0];
      console.log("MetaMask active account:", activeAccount);
      console.log("Passed userAddress:", userAddress);
      console.log("Addresses match:", activeAccount?.toLowerCase() === userAddress.toLowerCase());

      console.log("Creating encrypted input for:", { contractAddress, userAddress, value: value.toString() });

      // Debug: check SDK's public key and params
      const pubKey = instance.getPublicKey();
      console.log("SDK Public Key:", pubKey ? {
        publicKeyId: pubKey.publicKeyId,
        publicKeyLength: pubKey.publicKey?.length,
        pubKeyFirst20: pubKey.publicKey ? Array.from(pubKey.publicKey.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join('') : 'N/A'
      } : "null");

      // Check public params
      const pp64 = instance.getPublicParams ? instance.getPublicParams(64) : null;
      console.log("Public Params (64):", pp64 ? {
        paramsId: pp64.publicParamsId,
        paramsLength: pp64.publicParams?.length
      } : "null");

      const input = instance.createEncryptedInput(contractAddress, userAddress);
      console.log("Input builder created, adding value...");
      input.add64(value);
      console.log("Calling encrypt()...");
      console.log("Input bits:", input.getBits());
      const encrypted = await input.encrypt();
      console.log("Encrypt returned, processing...");

      // Debug: decode the handle to see what's inside
      const handleHex = Array.from(encrypted.handles[0]).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log("Raw handle hex:", handleHex);
      console.log("Handle first 20 bytes:", handleHex.slice(0, 40));

      // Debug: show proof structure
      const proofHex = Array.from(encrypted.inputProof).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log("Proof structure:");
      console.log("  Num handles:", parseInt(proofHex.slice(0, 2), 16));
      console.log("  Num signers:", parseInt(proofHex.slice(2, 4), 16));
      console.log("  Handle in proof:", proofHex.slice(4, 68));
      console.log("  Signature:", proofHex.slice(68, 198));

      // Convert Uint8Arrays to hex strings for ethers.js
      const handles = encrypted.handles.map((h: Uint8Array) => toHexString(h));
      const inputProof = toHexString(encrypted.inputProof);

      console.log("Encryption successful:", {
        handles,
        proofLength: inputProof.length,
        rawHandleLength: encrypted.handles[0]?.length,
        rawProofLength: encrypted.inputProof.length,
      });

      return {
        handles,
        inputProof,
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

      // Convert Uint8Arrays to hex strings for ethers.js
      const handles = encrypted.handles.map((h: Uint8Array) => toHexString(h));
      const inputProof = toHexString(encrypted.inputProof);

      return {
        handles,
        inputProof,
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
