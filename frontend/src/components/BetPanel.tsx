import { useState } from "react";
import { ethers } from "ethers";

interface BetPanelProps {
  balance: bigint | null;
  isOperatorSet: boolean;
  hasPendingSpin: boolean;
  isSpinning: boolean;
  isBuying: boolean;
  onSpin: (amount: bigint) => void;
  onBuyTokens: (ethAmount: string) => void;
  onSetOperator: () => void;
  onDecryptBalance: () => void;
  isDecrypting: boolean;
}

export function BetPanel({
  balance,
  isOperatorSet,
  hasPendingSpin,
  isSpinning,
  isBuying,
  onSpin,
  onBuyTokens,
  onSetOperator,
  onDecryptBalance,
  isDecrypting,
}: BetPanelProps) {
  const [betAmount, setBetAmount] = useState("10");
  const [buyAmount, setBuyAmount] = useState("0.01");

  const handleSpin = () => {
    const amount = ethers.parseUnits(betAmount, 6);
    onSpin(amount);
  };

  const handleBuy = () => {
    onBuyTokens(buyAmount);
  };

  const formatBalance = (bal: bigint | null) => {
    if (bal === null) return "Encrypted";
    return ethers.formatUnits(bal, 6);
  };

  return (
    <div style={styles.container}>
      {/* Balance Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Your Balance</h3>
        <div style={styles.balanceRow}>
          <span style={styles.balanceValue}>
            {formatBalance(balance)} WHEEL
          </span>
          {balance === null && (
            <button
              onClick={onDecryptBalance}
              disabled={isDecrypting}
              style={styles.smallButton}
            >
              {isDecrypting ? "Decrypting..." : "Reveal"}
            </button>
          )}
        </div>
      </div>

      {/* Buy Tokens Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Buy Tokens</h3>
        <div style={styles.inputRow}>
          <input
            type="number"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            min="0.001"
            step="0.001"
            style={styles.input}
          />
          <span style={styles.unit}>ETH</span>
        </div>
        <button
          onClick={handleBuy}
          disabled={isBuying}
          style={styles.button}
        >
          {isBuying ? "Buying..." : "Buy WHEEL Tokens"}
        </button>
        <p style={styles.hint}>0.001 ETH = 100,000 WHEEL tokens</p>
      </div>

      {/* Operator Approval */}
      {!isOperatorSet && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Game Approval Required</h3>
          <p style={styles.hint}>
            Approve the game contract to transfer tokens on your behalf when you spin.
          </p>
          <button onClick={onSetOperator} style={styles.button}>
            Approve Game Contract
          </button>
        </div>
      )}

      {/* Bet Section */}
      {isOperatorSet && !hasPendingSpin && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Place Your Bet</h3>
          <div style={styles.inputRow}>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="1"
              max="1000"
              style={styles.input}
            />
            <span style={styles.unit}>WHEEL</span>
          </div>
          <div style={styles.quickBets}>
            {["1", "10", "50", "100"].map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount)}
                style={styles.quickBetButton}
              >
                {amount}
              </button>
            ))}
          </div>
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            style={{
              ...styles.spinButton,
              opacity: isSpinning ? 0.7 : 1,
            }}
          >
            {isSpinning ? "Spinning..." : "SPIN THE WHEEL!"}
          </button>
        </div>
      )}

      {/* Pending Spin Notice */}
      {hasPendingSpin && (
        <div style={styles.section}>
          <p style={styles.pendingText}>
            You have a pending spin result!
            Check the result panel to claim your prize.
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "24px",
    maxWidth: "400px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#fff",
  },
  balanceRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  balanceValue: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#ffd700",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    fontSize: "18px",
    borderRadius: "8px",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    color: "#fff",
    outline: "none",
  },
  unit: {
    fontSize: "16px",
    color: "rgba(255, 255, 255, 0.7)",
    minWidth: "60px",
  },
  button: {
    width: "100%",
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "600",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#3498db",
    color: "#fff",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  smallButton: {
    padding: "8px 16px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#9b59b6",
    color: "#fff",
    cursor: "pointer",
  },
  spinButton: {
    width: "100%",
    padding: "16px 24px",
    fontSize: "20px",
    fontWeight: "bold",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(243, 156, 18, 0.4)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  quickBets: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  quickBetButton: {
    flex: 1,
    padding: "8px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    backgroundColor: "transparent",
    color: "#fff",
    cursor: "pointer",
  },
  hint: {
    fontSize: "12px",
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: "8px",
    textAlign: "center" as const,
  },
  pendingText: {
    color: "#ffd700",
    textAlign: "center" as const,
    fontWeight: "500",
  },
};
