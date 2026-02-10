import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const Step: React.FC<{
  number: number;
  title: string;
  description: string;
  delay: number;
  active: boolean;
}> = ({ number, title, description, delay, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const scale = spring({ frame: frame - delay, fps, from: 0.95, to: 1, durationInFrames: 10 });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        alignItems: "flex-start",
        gap: 24,
        padding: 28,
        background: active ? "#f8f8f8" : "white",
        border: active ? "2px solid black" : "1px solid #e5e5e5",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          background: active ? "black" : "#f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 600,
          color: active ? "white" : "#888",
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <div style={{ color: "black", fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ color: "#666", fontSize: 16, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </div>
  );
};

export const FlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame, fps, from: 15, to: 0, durationInFrames: 15 });

  // Which step is currently active
  const activeStep = Math.floor(interpolate(frame, [30, 100], [1, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  }));

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

      <div style={{ display: "flex", gap: 80, position: "relative", zIndex: 1 }}>
        {/* Left side - Title */}
        <div style={{ flex: "0 0 400px" }}>
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              position: "sticky",
              top: 80,
            }}
          >
            <h1
              style={{
                fontSize: 56,
                fontWeight: 400,
                color: "black",
                margin: 0,
                fontFamily: "'Instrument Serif', Georgia, serif",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              How it works
            </h1>
            <p style={{ fontSize: 20, color: "#666", marginTop: 20, lineHeight: 1.6 }}>
              From click to streaming in seconds. No accounts, no API keys, no gas fees.
            </p>

            {/* Key benefit */}
            {frame > 80 && (
              <div
                style={{
                  marginTop: 40,
                  padding: 24,
                  border: "2px solid black",
                  opacity: interpolate(frame, [80, 90], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600, color: "black" }}>
                  You only sign a message
                </div>
                <div style={{ fontSize: 14, color: "#666", marginTop: 8 }}>
                  The facilitator pays all gas fees
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Steps */}
        <div style={{ flex: 1 }}>
          <Step
            number={1}
            title="Connect your wallet"
            description="One-time permission grant to allow stream creation on your behalf"
            delay={5}
            active={activeStep === 1}
          />

          <Step
            number={2}
            title="Access protected content"
            description="Server checks for active subscription stream"
            delay={15}
            active={activeStep === 2}
          />

          <Step
            number={3}
            title="Sign payment authorization"
            description="Simple signature - no transaction, no gas required"
            delay={25}
            active={activeStep === 3}
          />

          <Step
            number={4}
            title="Stream is created"
            description="USDC is wrapped and stream begins flowing to the DAO"
            delay={35}
            active={activeStep === 4}
          />

          <Step
            number={5}
            title="Access granted"
            description="Enjoy the service as long as your stream is active"
            delay={45}
            active={activeStep >= 5}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
