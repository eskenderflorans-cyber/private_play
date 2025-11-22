import { useEffect, useState } from "react";
import { useWallet, useFhevm, useFortuneWheel, PRIZE_SEGMENTS } from "./hooks";
import { WheelSpinner, BetPanel, ResultModal } from "./components";

// Contract addresses (update after deployment)
const WHEEL_TOKEN_ADDRESS = import.meta.env.VITE_WHEEL_TOKEN_ADDRESS || "";
const FORTUNE_WHEEL_ADDRESS = import.meta.env.VITE_FORTUNE_WHEEL_ADDRESS || "";

function App() {
  const {
    address,
    signer,
    isConnected,
    isConnecting,
    error: walletError,
    connect,
  } = useWallet();

  const {
    status: fhevmStatus,
    error: fhevmError,
    initialize: initializeFhevm,
    isInitialized,
  } = useFhevm(address); // Pass current address to detect account changes

  const {
    balance,
    hasPendingSpin,
    spinResult,
    isOperatorSet,
    error: gameError,
    isSpinning,
    isClaiming,
    isBuying,
    isDecrypting,
    buyTokens,
    setOperator,
    spin,
    claimPrize,
    decryptBalance,
    fetchSpinResult,
  } = useFortuneWheel(
    WHEEL_TOKEN_ADDRESS,
    FORTUNE_WHEEL_ADDRESS,
    signer,
    address
  );

  const [showResult, setShowResult] = useState(false);

  // Initialize FHEVM after wallet connects
  useEffect(() => {
    if (isConnected && fhevmStatus === "idle") {
      initializeFhevm();
    }
  }, [isConnected, fhevmStatus, initializeFhevm]);

  // Show result modal when there's a pending spin
  useEffect(() => {
    if (hasPendingSpin) {
      setShowResult(true);
    }
  }, [hasPendingSpin]);

  const error = walletError || fhevmError || gameError;

  // Not connected view
  if (!isConnected) {
    return (
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Fortune Wheel</h1>
          <p style={styles.subtitle}>
            The first fully private prize wheel game on blockchain
          </p>
          <p style={styles.description}>
            Powered by Zama FHEVM - Your bets, outcomes, and winnings are
            encrypted. Only you can see your results.
          </p>

          <button
            onClick={connect}
            disabled={isConnecting}
            style={styles.connectButton}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.features}>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>?</div>
              <h3>Fully Private</h3>
              <p>All game data encrypted with FHE</p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>!</div>
              <h3>Provably Fair</h3>
              <p>On-chain random number generation</p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>*</div>
              <h3>Win Big</h3>
              <p>Up to 100x multiplier prizes</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading FHEVM
  if (!isInitialized) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <h2>Initializing Encryption...</h2>
          <p>Status: {fhevmStatus}</p>
          {fhevmError && <p style={styles.error}>{fhevmError}</p>}
        </div>
      </div>
    );
  }

  // Check contract addresses
  if (!WHEEL_TOKEN_ADDRESS || !FORTUNE_WHEEL_ADDRESS) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <h2>Configuration Error</h2>
          <p>
            Contract addresses not set. Please update your .env file with:
          </p>
          <code style={styles.code}>
            VITE_WHEEL_TOKEN_ADDRESS=0x...
            <br />
            VITE_FORTUNE_WHEEL_ADDRESS=0x...
          </code>
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>Fortune Wheel</h1>
        <div style={styles.walletInfo}>
          <span style={styles.address}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <span style={styles.network}>Sepolia</span>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.gameArea}>
          {/* Wheel */}
          <div style={styles.wheelContainer}>
            <WheelSpinner
              isSpinning={isSpinning}
              resultSegment={spinResult.isDecrypted ? spinResult.segment : null}
            />
          </div>

          {/* Bet Panel */}
          <div style={styles.panelContainer}>
            <BetPanel
              balance={balance}
              isOperatorSet={isOperatorSet}
              hasPendingSpin={hasPendingSpin}
              isSpinning={isSpinning}
              isBuying={isBuying}
              onSpin={spin}
              onBuyTokens={buyTokens}
              onSetOperator={setOperator}
              onDecryptBalance={decryptBalance}
              isDecrypting={isDecrypting}
            />
          </div>
        </div>

        {/* Prize Table */}
        <div style={styles.prizeTable}>
          <h3 style={styles.prizeTableTitle}>Prize Segments</h3>
          <div style={styles.prizeGrid}>
            {PRIZE_SEGMENTS.map((segment) => (
              <div
                key={segment.segment}
                style={{
                  ...styles.prizeItem,
                  borderColor: segment.color,
                }}
              >
                <span
                  style={{
                    ...styles.prizeLabel,
                    backgroundColor: segment.color,
                  }}
                >
                  {segment.label}
                </span>
                <span style={styles.prizeMultiplier}>
                  {segment.multiplier === 0 ? "Lose" : `${segment.multiplier}x`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Result Modal */}
      {showResult && (
        <ResultModal
          hasPendingSpin={hasPendingSpin}
          spinResult={spinResult}
          isClaiming={isClaiming}
          isDecrypting={isDecrypting}
          onDecrypt={fetchSpinResult}
          onClaim={claimPrize}
          onClose={() => setShowResult(false)}
        />
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <p>Built on Zama FHEVM - Fully Homomorphic Encryption</p>
        <p style={styles.footerSubtext}>
          All bets and results are encrypted. Only you can see your game data.
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  hero: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  title: {
    fontSize: "48px",
    fontWeight: "bold",
    marginBottom: "16px",
    background: "linear-gradient(135deg, #ffd700 0%, #f39c12 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    fontSize: "20px",
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: "16px",
  },
  description: {
    fontSize: "16px",
    color: "rgba(255, 255, 255, 0.6)",
    maxWidth: "500px",
    marginBottom: "32px",
  },
  connectButton: {
    padding: "16px 48px",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(243, 156, 18, 0.4)",
  },
  features: {
    display: "flex",
    gap: "40px",
    marginTop: "60px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  feature: {
    textAlign: "center",
    maxWidth: "200px",
  },
  featureIcon: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "24px",
    margin: "0 auto 16px",
    color: "#ffd700",
  },
  loading: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  code: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
    fontSize: "14px",
    color: "#ffd700",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 40px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  },
  logo: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#ffd700",
  },
  walletInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  address: {
    padding: "8px 16px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "20px",
    fontSize: "14px",
  },
  network: {
    padding: "4px 12px",
    backgroundColor: "#27ae60",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "rgba(231, 76, 60, 0.2)",
    border: "1px solid #e74c3c",
    color: "#e74c3c",
    padding: "12px 20px",
    textAlign: "center",
  },
  error: {
    color: "#e74c3c",
    marginTop: "16px",
  },
  main: {
    flex: 1,
    padding: "40px 20px",
  },
  gameArea: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: "60px",
    flexWrap: "wrap",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  wheelContainer: {
    flex: "0 0 auto",
  },
  panelContainer: {
    flex: "0 0 auto",
  },
  prizeTable: {
    maxWidth: "800px",
    margin: "60px auto 0",
    padding: "24px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
  },
  prizeTableTitle: {
    textAlign: "center",
    marginBottom: "24px",
    fontSize: "18px",
    color: "#fff",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
    gap: "12px",
  },
  prizeItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px",
    borderRadius: "8px",
    border: "2px solid",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  prizeLabel: {
    padding: "4px 12px",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: "8px",
  },
  prizeMultiplier: {
    fontSize: "12px",
    color: "rgba(255, 255, 255, 0.7)",
  },
  footer: {
    textAlign: "center",
    padding: "30px",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: "14px",
  },
  footerSubtext: {
    fontSize: "12px",
    marginTop: "8px",
  },
};

export default App;
