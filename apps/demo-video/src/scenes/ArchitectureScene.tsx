import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const ComparisonRow: React.FC<{
  oldWay: string;
  newWay: string;
  delay: number;
}> = ({ oldWay, newWay, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = spring({ frame: frame - delay, fps, from: 15, to: 0, durationInFrames: 12 });

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${x}px)`,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 60,
        marginBottom: 32,
      }}
    >
      <div
        style={{
          padding: 24,
          background: "#f5f5f5",
          borderRadius: 8,
          borderLeft: "4px solid #ccc",
        }}
      >
        <div style={{ color: "#888", fontSize: 14, marginBottom: 8, fontWeight: 500 }}>THE OLD WAY</div>
        <div style={{ color: "#666", fontSize: 22 }}>{oldWay}</div>
      </div>
      <div
        style={{
          padding: 24,
          background: "#f8fdf9",
          borderRadius: 8,
          borderLeft: "4px solid black",
        }}
      >
        <div style={{ color: "black", fontSize: 14, marginBottom: 8, fontWeight: 600 }}>WITH x402 + SUPERFLUID</div>
        <div style={{ color: "black", fontSize: 22, fontWeight: 500 }}>{newWay}</div>
      </div>
    </div>
  );
};

export const ArchitectureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame, fps, from: 15, to: 0, durationInFrames: 15 });

  return (
    <AbsoluteFill
      style={{
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 80,
      }}
    >
      {/* Subtle grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 60,
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: 400,
              color: "black",
              margin: 0,
              fontFamily: "'Instrument Serif', Georgia, serif",
              letterSpacing: "-0.02em",
            }}
          >
            A better way to pay
          </h1>
          <p style={{ fontSize: 24, color: "#666", marginTop: 16 }}>
            Internet-native subscriptions that just work
          </p>
        </div>

        {/* Comparisons */}
        <ComparisonRow
          oldWay="Create account, add payment, KYC..."
          newWay="Connect wallet and go"
          delay={15}
        />

        <ComparisonRow
          oldWay="Pay gas fees for every transaction"
          newWay="Sign once, no gas fees"
          delay={25}
        />

        <ComparisonRow
          oldWay="Monthly billing cycles, lock-in"
          newWay="Real-time money streams, cancel anytime"
          delay={35}
        />

        <ComparisonRow
          oldWay="API keys, credentials, security risks"
          newWay="Your wallet is your identity"
          delay={45}
        />

        {/* Bottom callout */}
        {frame > 55 && (
          <div
            style={{
              marginTop: 40,
              padding: 32,
              border: "2px solid black",
              background: "white",
              opacity: interpolate(frame, [55, 65], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 600, color: "black", marginBottom: 8 }}>
              1 USDC/month money stream to the DAO treasury
            </div>
            <div style={{ fontSize: 18, color: "#666" }}>
              Fair, transparent pricing with no hidden fees
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
