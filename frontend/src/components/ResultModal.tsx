import { ethers } from "ethers";
import { PRIZE_SEGMENTS, SpinResult } from "../hooks";

interface ResultModalProps {
  hasPendingSpin: boolean;
  spinResult: SpinResult;
  isClaiming: boolean;
  isDecrypting: boolean;
  onDecrypt: () => void;
  onClaim: () => void;
  onClose: () => void;
}

export function ResultModal({
  hasPendingSpin,
  spinResult,
  isClaiming,
  isDecrypting,
  onDecrypt,
  onClaim,
  onClose,
}: ResultModalProps) {
  if (!hasPendingSpin) return null;

  const segment = spinResult.segment !== null ? PRIZE_SEGMENTS[spinResult.segment] : null;
  const winnings = spinResult.winnings;
  const betAmount = spinResult.betAmount;

  const formatAmount = (amount: bigint | null) => {
    if (amount === null) return "???";
    return ethers.formatUnits(amount, 18);
  };

  const isWin = winnings !== null && winnings > 0n;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button onClick={onClose} style={styles.closeButton}>
          x
        </button>

        <h2 style={styles.title}>Spin Result</h2>

        {!spinResult.isDecrypted ? (
          // Encrypted state
          <div style={styles.encryptedContent}>
            <div style={styles.lockIcon}>?</div>
            <p style={styles.encryptedText}>
              Your result is encrypted and private.
              <br />
              Only you can reveal it.
            </p>
            <button
              onClick={onDecrypt}
              disabled={isDecrypting}
              style={styles.decryptButton}
            >
              {isDecrypting ? "Decrypting..." : "Reveal My Result"}
            </button>
          </div>
        ) : (
          // Decrypted state
          <div style={styles.resultContent}>
            {segment && (
              <div
                style={{
                  ...styles.segmentBadge,
                  backgroundColor: segment.color,
                }}
              >
                {segment.label}
              </div>
            )}

            <div style={styles.resultDetails}>
              <div style={styles.resultRow}>
                <span>Your Bet:</span>
                <span>{formatAmount(betAmount)} WHEEL</span>
              </div>
              <div style={styles.resultRow}>
                <span>Multiplier:</span>
                <span>{segment?.multiplier ?? 0}x</span>
              </div>
              <div style={{ ...styles.resultRow, ...styles.winningsRow }}>
                <span>Winnings:</span>
                <span style={{ color: isWin ? "#2ecc71" : "#e74c3c" }}>
                  {formatAmount(winnings)} WHEEL
                </span>
              </div>
            </div>

            {isWin ? (
              <div style={styles.winMessage}>Congratulations! You won!</div>
            ) : (
              <div style={styles.loseMessage}>Better luck next time!</div>
            )}

            <button
              onClick={onClaim}
              disabled={isClaiming}
              style={styles.claimButton}
            >
              {isClaiming ? "Claiming..." : "Claim Prize"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#1a1a2e",
    borderRadius: "20px",
    padding: "32px",
    maxWidth: "420px",
    width: "90%",
    position: "relative",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
    border: "2px solid rgba(255, 255, 255, 0.1)",
  },
  closeButton: {
    position: "absolute",
    top: "16px",
    right: "16px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#fff",
    fontSize: "18px",
    cursor: "pointer",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "center" as const,
    marginBottom: "24px",
    color: "#fff",
  },
  encryptedContent: {
    textAlign: "center" as const,
  },
  lockIcon: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: "rgba(155, 89, 182, 0.3)",
    border: "3px solid #9b59b6",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "40px",
    margin: "0 auto 24px",
    color: "#9b59b6",
  },
  encryptedText: {
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: "24px",
    lineHeight: 1.6,
  },
  decryptButton: {
    width: "100%",
    padding: "16px 24px",
    fontSize: "18px",
    fontWeight: "600",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
    color: "#fff",
    cursor: "pointer",
  },
  resultContent: {
    textAlign: "center" as const,
  },
  segmentBadge: {
    display: "inline-block",
    padding: "12px 32px",
    fontSize: "32px",
    fontWeight: "bold",
    borderRadius: "12px",
    color: "#fff",
    marginBottom: "24px",
    textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
  },
  resultDetails: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "24px",
  },
  resultRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#fff",
  },
  winningsRow: {
    borderBottom: "none",
    fontSize: "18px",
    fontWeight: "bold",
  },
  winMessage: {
    color: "#2ecc71",
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "24px",
  },
  loseMessage: {
    color: "#e74c3c",
    fontSize: "18px",
    marginBottom: "24px",
  },
  claimButton: {
    width: "100%",
    padding: "16px 24px",
    fontSize: "18px",
    fontWeight: "600",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)",
    color: "#fff",
    cursor: "pointer",
  },
};
