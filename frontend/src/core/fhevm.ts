import { createInstance, SepoliaConfig, initSDK } from "@zama-fhe/relayer-sdk/web";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { BrowserProvider } from "ethers";

let fheInstance: FhevmInstance | null = null;
let isInitialized = false;
let sdkInitialized = false;
let currentAccount: string | null = null;

export async function initializeFheInstance(): Promise<FhevmInstance> {
  if (!window.ethereum) {
    throw new Error("Ethereum provider not found. Please install MetaMask.");
  }

  // Initialize WASM modules first (only once)
  if (!sdkInitialized) {
    console.log("Initializing FHEVM SDK WASM...");
    await initSDK();
    sdkInitialized = true;
  }

  // Get current account
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const activeAccount = accounts[0]?.toLowerCase();
  console.log("Connected accounts:", accounts);
  console.log("Active account:", activeAccount);
  console.log("Previously cached account:", currentAccount);

  // Check if we need to reinitialize (account changed or first init)
  if (fheInstance && isInitialized && currentAccount === activeAccount) {
    console.log("Reusing existing FHEVM instance for same account");
    return fheInstance;
  }

  // Account changed or first initialization
  if (currentAccount && currentAccount !== activeAccount) {
    console.log("Account changed! Reinitializing FHEVM instance...");
  }

  // Create new instance with wallet provider
  const config = { ...SepoliaConfig, network: window.ethereum };
  console.log("FHEVM Config:", {
    chainId: SepoliaConfig.chainId,
    aclContractAddress: SepoliaConfig.aclContractAddress,
    kmsContractAddress: SepoliaConfig.kmsContractAddress,
    relayerUrl: SepoliaConfig.relayerUrl,
    inputVerifierContractAddress: SepoliaConfig.inputVerifierContractAddress,
  });

  fheInstance = await createInstance(config);
  isInitialized = true;
  currentAccount = activeAccount;
  console.log("FHEVM instance created successfully for account:", currentAccount);

  return fheInstance;
}

// Force reinitialize (call this when account changes)
export function resetFheInstance(): void {
  console.log("Resetting FHEVM instance...");
  fheInstance = null;
  isInitialized = false;
  currentAccount = null;
}

export function getFheInstance(): FhevmInstance | null {
  return fheInstance;
}

export function isInstanceReady(): boolean {
  return isInitialized && fheInstance !== null;
}

export function getCurrentAccount(): string | null {
  return currentAccount;
}
