import { useState, useCallback } from "react";
import { initializeFheInstance, getFheInstance } from "../core/fhevm";

export type FhevmStatus = "idle" | "loading" | "ready" | "error";

export function useFhevm() {
  const [status, setStatus] = useState<FhevmStatus>(
    getFheInstance() ? "ready" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (status === "loading" || status === "ready") return;

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
