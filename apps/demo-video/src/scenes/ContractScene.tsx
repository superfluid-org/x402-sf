import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const CodeLine: React.FC<{ children: string; delay: number; indent?: number }> = ({
  children,
  delay,
  indent = 0
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  return (
    <div
      style={{
        opacity,
        paddingLeft: indent * 24,
        fontFamily: "monospace",
        fontSize: 18,
        lineHeight: 1.8,
        color: "rgba(255,255,255,0.9)",
      }}
    >
      {children}
    </div>
  );
};

const RoleCard: React.FC<{
  title: string;
  address: string;
  description: string;
  color: string;
  delay: number;
}> = ({ title, address, description, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = spring({ frame: frame - delay, fps, from: 0.9, to: 1, durationInFrames: 25 });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        padding: 24,
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        border: `1px solid ${color}50`,
        borderRadius: 12,
        flex: 1,
      }}
    >
      <div style={{ color, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ color: "white", fontSize: 14, fontFamily: "monospace", marginBottom: 12 }}>
        {address}
      </div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{description}</div>
    </div>
  );
};

export const ContractScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #1e1b4b 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 60,
      }}
    >
      {/* Title */}
      <div style={{ opacity: titleOpacity, marginBottom: 40 }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, color: "white", margin: 0 }}>
          SuperfluidFacilitator Contract
        </h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
          One atomic transaction does everything
        </p>
      </div>

      <div style={{ display: "flex", gap: 40 }}>
        {/* Code panel */}
        <div
          style={{
            flex: 1,
            background: "rgba(0,0,0,0.5)",
            borderRadius: 16,
            padding: 32,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ color: "#10b981", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
            processPayment()
          </div>

          <CodeLine delay={30}>
            {"function processPayment("}
          </CodeLine>
          <CodeLine delay={45} indent={1}>
            {"address from,        // User wallet"}
          </CodeLine>
          <CodeLine delay={60} indent={1}>
            {"uint256 value,       // Total USDC"}
          </CodeLine>
          <CodeLine delay={75} indent={1}>
            {"AuthParams auth,     // EIP-3009 sig"}
          </CodeLine>
          <CodeLine delay={90} indent={1}>
            {"address recipient,   // Stream to"}
          </CodeLine>
          <CodeLine delay={105} indent={1}>
            {"int96 flowRate       // Per second"}
          </CodeLine>
          <CodeLine delay={120}>
            {") {"}
          </CodeLine>
          <CodeLine delay={150} indent={1}>
            <span style={{ color: "#f59e0b" }}>{"// 1. Pull USDC via transferWithAuth"}</span>
          </CodeLine>
          <CodeLine delay={180} indent={1}>
            <span style={{ color: "#10b981" }}>{"// 2. Take 1 USDC fee"}</span>
          </CodeLine>
          <CodeLine delay={210} indent={1}>
            <span style={{ color: "#3b82f6" }}>{"// 3. Wrap remaining to USDCx"}</span>
          </CodeLine>
          <CodeLine delay={240} indent={1}>
            <span style={{ color: "#ec4899" }}>{"// 4. Create Superfluid stream"}</span>
          </CodeLine>
          <CodeLine delay={270}>
            {"}"}
          </CodeLine>
        </div>

        {/* Roles panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <RoleCard
            title="OWNER"
            address="0x206BD7...9560"
            description="Cold wallet / multisig. Can change settings, withdraw fees."
            color="#8b5cf6"
            delay={300}
          />
          <RoleCard
            title="OPERATOR"
            address="0xE2e20E...9074"
            description="Server hot wallet. Can only call processPayment()."
            color="#3b82f6"
            delay={330}
          />
          <RoleCard
            title="TREASURY"
            address="0xac8088...4e1"
            description="DAO Treasury. Receives withdrawn fees."
            color="#10b981"
            delay={360}
          />
        </div>
      </div>

      {/* Fee model */}
      {frame > 400 && (
        <div
          style={{
            marginTop: 40,
            padding: 24,
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-around",
            opacity: interpolate(frame, [400, 430], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f59e0b", fontSize: 32, fontWeight: 700 }}>1 USDC</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Flat fee (deposit)</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#10b981", fontSize: 32, fontWeight: 700 }}>1 USDC</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Wrapped to USDCx</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#ec4899", fontSize: 32, fontWeight: 700 }}>1/month</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Stream to DAO</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
