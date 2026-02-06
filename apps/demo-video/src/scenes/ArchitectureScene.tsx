import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const Box: React.FC<{
  children: React.ReactNode;
  color: string;
  delay: number;
  x: number;
  y: number;
  width?: number;
}> = ({ children, color, delay, x, y, width = 280 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = spring({ frame: frame - delay, fps, from: 0.8, to: 1, durationInFrames: 30 });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        padding: 20,
        background: `linear-gradient(135deg, ${color}20, ${color}10)`,
        border: `2px solid ${color}`,
        borderRadius: 12,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};

const Arrow: React.FC<{
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
  label?: string;
}> = ({ fromX, fromY, toX, toY, delay, label }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const currentX = fromX + (toX - fromX) * progress;
  const currentY = fromY + (toY - fromY) * progress;

  return (
    <>
      <svg
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
        </defs>
        <line
          x1={fromX}
          y1={fromY}
          x2={currentX}
          y2={currentY}
          stroke="#6366f1"
          strokeWidth={2}
          markerEnd={progress > 0.9 ? "url(#arrowhead)" : undefined}
        />
      </svg>
      {label && progress > 0.5 && (
        <div
          style={{
            position: "absolute",
            left: (fromX + toX) / 2 - 80,
            top: (fromY + toY) / 2 - 30,
            fontSize: 14,
            color: "#a5b4fc",
            background: "rgba(0,0,0,0.8)",
            padding: "4px 12px",
            borderRadius: 4,
            opacity: interpolate(frame, [delay + 15, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {label}
        </div>
      )}
    </>
  );
};

export const ArchitectureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #0f172a 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 60,
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          marginBottom: 40,
        }}
      >
        <h1 style={{ fontSize: 56, fontWeight: 700, color: "white", margin: 0 }}>
          Architecture Overview
        </h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
          How x402 + Superfluid powers community AI
        </p>
      </div>

      {/* Browser */}
      <Box color="#3b82f6" delay={30} x={100} y={200}>
        <div style={{ color: "#3b82f6", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>BROWSER</div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>x402-axios</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          Intercepts 402 responses
        </div>
      </Box>

      {/* Facilitator API */}
      <Box color="#8b5cf6" delay={60} x={500} y={200}>
        <div style={{ color: "#8b5cf6", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>BACKEND</div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Facilitator API</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          Hono server (operator)
        </div>
      </Box>

      {/* Contract */}
      <Box color="#10b981" delay={90} x={900} y={200} width={400}>
        <div style={{ color: "#10b981", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>CONTRACT</div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>SuperfluidFacilitator</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          Atomic: Pull USDC → Wrap → Stream
        </div>
      </Box>

      {/* USDC */}
      <Box color="#f59e0b" delay={120} x={900} y={420}>
        <div style={{ color: "#f59e0b", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>TOKEN</div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>USDC (EIP-3009)</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          Gasless transfers
        </div>
      </Box>

      {/* Superfluid */}
      <Box color="#06b6d4" delay={150} x={1200} y={420}>
        <div style={{ color: "#06b6d4", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>PROTOCOL</div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Superfluid CFA</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          Real-time streams
        </div>
      </Box>

      {/* DAO Treasury */}
      <Box color="#ec4899" delay={180} x={1500} y={200}>
        <div style={{ color: "#ec4899", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>DESTINATION</div>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>DAO Treasury</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          1 USDCx/month
        </div>
      </Box>

      {/* Arrows */}
      <Arrow fromX={380} fromY={260} toX={500} toY={260} delay={200} label="402 Response" />
      <Arrow fromX={780} fromY={260} toX={900} toY={260} delay={230} label="processPayment()" />
      <Arrow fromX={1100} fromY={340} toX={1100} toY={420} delay={260} label="Pull USDC" />
      <Arrow fromX={1180} fromY={480} toX={1200} toY={480} delay={290} label="Create Stream" />
      <Arrow fromX={1480} fromY={480} toX={1580} toY={340} delay={320} label="Stream to DAO" />

      {/* Key insight */}
      {frame > 400 && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 100,
            right: 100,
            padding: 24,
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: 12,
            opacity: interpolate(frame, [400, 430], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ color: "#a5b4fc", fontSize: 20, fontWeight: 600 }}>
            Key Insight: User only signs a message - no gas fees!
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, marginTop: 8 }}>
            The facilitator (operator) pays gas to execute the atomic contract call
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
