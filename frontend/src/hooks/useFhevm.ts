import { useState, useCallback, useEffect } from "react";
import { initializeFheInstance, getFheInstance, resetFheInstance, getCurrentAccount } from "../core/fhevm";

export type FhevmStatus = "idle" | "loading" | "ready" | "error";

export function useFhevm(currentUserAddress?: string) {
  const [status, setStatus] = useState<FhevmStatus>(
    getFheInstance() ? "ready" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  // Check if account changed and reset if needed
  useEffect(() => {
    if (!currentUserAddress) return;

    const cachedAccount = getCurrentAccount();
    if (cachedAccount && cachedAccount !== currentUserAddress.toLowerCase()) {
      console.log("Account changed detected in useFhevm, resetting...");
      resetFheInstance();
      setStatus("idle");
    }
  }, [currentUserAddress]);

  const initialize = useCallback(async (forceReinit = false) => {
    if (status === "loading") return;
    if (status === "ready" && !forceReinit) return;

    if (forceReinit) {
      resetFheInstance();
    }

    setStatus("loading");
    setError(null);

    try {
      await initializeFheInstance();
      setStatus("ready");
    } catch (err) {
      console.error("FHEVM initialization error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [status]);

  const reset = useCallback(() => {
    resetFheInstance();
    setStatus("idle");
    setError(null);
  }, []);

  return {
    status,
    error,
    initialize,
    reset,
    isInitialized: status === "ready",
    isLoading: status === "loading",
  };
}
