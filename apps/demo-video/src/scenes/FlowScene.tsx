import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const Step: React.FC<{
  number: number;
  title: string;
  description: string;
  color: string;
  delay: number;
  active: boolean;
}> = ({ number, title, description, color, delay, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const scale = spring({ frame: frame - delay, fps, from: 0.9, to: 1, durationInFrames: 25 });
  const glow = active ? `0 0 30px ${color}50` : "none";

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        alignItems: "flex-start",
        gap: 24,
        padding: 24,
        background: active ? `${color}10` : "rgba(255,255,255,0.02)",
        border: `2px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
        borderRadius: 16,
        boxShadow: glow,
        transition: "all 0.3s",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: active ? color : "rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 700,
          color: active ? "white" : "rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <div style={{ color: "white", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </div>
  );
};

export const FlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Which step is currently active
  const activeStep = Math.floor(interpolate(frame, [150, 750], [1, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  }));

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #172554 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 60,
      }}
    >
      {/* Title */}
      <div style={{ opacity: titleOpacity, marginBottom: 40 }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, color: "white", margin: 0 }}>
          User Payment Flow
        </h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
          From click to streaming - no wallet transaction needed
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Step
          number={1}
          title="Connect Wallet & Grant ACL"
          description="One-time: Allow facilitator contract to create streams on your behalf via CFA Forwarder"
          color="#8b5cf6"
          delay={30}
          active={activeStep === 1}
        />

        <Step
          number={2}
          title="Request Protected Resource"
          description="Click 'Access Content' - server returns HTTP 402 with payment requirements"
          color="#3b82f6"
          delay={60}
          active={activeStep === 2}
        />

        <Step
          number={3}
          title="Sign Payment Authorization"
          description="x402-axios prompts wallet to sign EIP-3009 TransferWithAuthorization (gasless!)"
          color="#10b981"
          delay={90}
          active={activeStep === 3}
        />

        <Step
          number={4}
          title="Facilitator Processes Payment"
          description="Backend calls contract's processPayment() - atomically pulls USDC, wraps, creates stream"
          color="#f59e0b"
          delay={120}
          active={activeStep === 4}
        />

        <Step
          number={5}
          title="Access Granted!"
          description="Stream is active to DAO treasury. User can now access content as long as stream is active."
          color="#ec4899"
          delay={150}
          active={activeStep >= 5}
        />
      </div>

      {/* Highlight box */}
      {frame > 600 && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 60,
            right: 60,
            padding: 24,
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 12,
            opacity: interpolate(frame, [600, 630], [0, 1], { extrapolateRight: "clamp" }),
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div style={{ fontSize: 48 }}>
            {"\u2728"}
          </div>
          <div>
            <div style={{ color: "#10b981", fontSize: 20, fontWeight: 600 }}>
              User never pays gas!
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, marginTop: 4 }}>
              They only sign a message. The operator pays gas to execute the contract.
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
