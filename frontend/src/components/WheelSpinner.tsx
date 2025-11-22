import { useState, useEffect, useRef } from "react";
import { PRIZE_SEGMENTS } from "../hooks";

interface WheelSpinnerProps {
  isSpinning: boolean;
  resultSegment: number | null;
  onSpinComplete?: () => void;
}

export function WheelSpinner({ isSpinning, resultSegment, onSpinComplete }: WheelSpinnerProps) {
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save state for rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Draw segments
    const segmentAngle = (2 * Math.PI) / PRIZE_SEGMENTS.length;

    PRIZE_SEGMENTS.forEach((segment, index) => {
      const startAngle = index * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(segment.label, radius - 20, 6);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // Draw pointer (outside rotation)
    ctx.beginPath();
    ctx.moveTo(centerX, 10);
    ctx.lineTo(centerX - 15, 40);
    ctx.lineTo(centerX + 15, 40);
    ctx.closePath();
    ctx.fillStyle = "#ffd700";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [rotation]);

  // Spin animation
  useEffect(() => {
    if (!isSpinning && resultSegment === null) return;

    if (isSpinning && !animating) {
      setAnimating(true);

      // Random spinning
      let currentRotation = rotation;
      let speed = 20;
      const deceleration = 0.98;

      const animate = () => {
        currentRotation += speed;
        speed *= deceleration;

        setRotation(currentRotation % 360);

        if (speed > 0.5) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setAnimating(false);
        }
      };

      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpinning, animating, rotation, resultSegment]);

  // Animate to result when decrypted
  useEffect(() => {
    if (resultSegment === null || isSpinning) return;

    // Calculate target rotation for the result segment
    const segmentAngle = 360 / PRIZE_SEGMENTS.length;
    const targetSegmentCenter = resultSegment * segmentAngle + segmentAngle / 2;
    // Pointer is at top (270 degrees), so we need to rotate so segment is there
    const targetRotation = 360 - targetSegmentCenter + 270;

    // Add extra rotations for effect
    const totalRotation = targetRotation + 360 * 5;

    let startRotation = rotation;
    let progress = 0;
    const duration = 3000; // 3 seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function (ease out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentRotation = startRotation + (totalRotation - startRotation) * eased;
      setRotation(currentRotation % 360);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onSpinComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [resultSegment, isSpinning, onSpinComplete]);

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={styles.canvas}
      />
      {isSpinning && (
        <div style={styles.overlay}>
          <div style={styles.spinText}>Spinning...</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  canvas: {
    maxWidth: "100%",
    height: "auto",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: "50%",
  },
  spinText: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#fff",
    textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
  },
};
