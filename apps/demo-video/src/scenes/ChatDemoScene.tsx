import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

// Venice logo as inline SVG (based on the provided image - cursive "Venice" text)
const VeniceLogo = () => (
  <svg viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: 32, width: "auto" }}>
    <text
      x="0"
      y="30"
      fontFamily="'Times New Roman', Georgia, serif"
      fontSize="32"
      fontStyle="italic"
      fontWeight="400"
      fill="black"
    >
      Venice
    </text>
  </svg>
);

const ChatMessage: React.FC<{
  role: "user" | "assistant";
  content: string;
  delay: number;
}> = ({ role, content, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const translateY = spring({ frame: frame - delay, fps, from: 10, to: 0, durationInFrames: 10 });

  const isUser = role === "user";

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: "75%",
          padding: "16px 20px",
          background: isUser ? "black" : "#f5f5f5",
          color: isUser ? "white" : "black",
          fontSize: 18,
          lineHeight: 1.5,
          borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
        }}
      >
        {content}
      </div>
    </div>
  );
};

export const ChatDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame, fps, from: 15, to: 0, durationInFrames: 15 });

  const typingDots = Math.floor(frame / 5) % 4;
  const showTyping = frame > 60 && frame < 80;

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

      <div style={{ display: "flex", gap: 60, position: "relative", zIndex: 1, height: "100%" }}>
        {/* Left side - Info */}
        <div style={{ flex: "0 0 350px" }}>
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            <h1
              style={{
                fontSize: 48,
                fontWeight: 400,
                color: "black",
                margin: 0,
                fontFamily: "'Instrument Serif', Georgia, serif",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Chat with AI
            </h1>
            <p style={{ fontSize: 18, color: "#666", marginTop: 16, lineHeight: 1.6 }}>
              Subscribers get 10 requests per day to uncensored AI models
            </p>
          </div>

          {/* Subscription card */}
          <div
            style={{
              marginTop: 40,
              padding: 24,
              border: "2px solid black",
              opacity: interpolate(frame, [10, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 8 }}>
              SUBSCRIPTION
            </div>
            <div style={{ fontSize: 32, fontWeight: 600, color: "black" }}>
              1 USDC <span style={{ fontSize: 16, fontWeight: 400, color: "#666" }}>/ month</span>
            </div>
            <div
              style={{
                marginTop: 16,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                background: "black",
                color: "white",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span>Active</span>
            </div>
          </div>

        </div>

        {/* Right side - Chat window */}
        <div
          style={{
            flex: 1,
            border: "1px solid #e5e5e5",
            display: "flex",
            flexDirection: "column",
            opacity: interpolate(frame, [5, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 20,
              borderBottom: "1px solid #e5e5e5",
            }}
          >
            <VeniceLogo />
            <div style={{ marginLeft: "auto", color: "#666", fontSize: 14 }}>
              8 / 10 requests remaining
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: 24, overflow: "hidden" }}>
            <ChatMessage
              role="user"
              content="What is Superfluid and how does money streaming work?"
              delay={20}
            />

            <ChatMessage
              role="assistant"
              content="Superfluid is a protocol for real-time finance. Instead of discrete transfers, money flows continuously by the second. Imagine your subscription streaming into the DAO treasury every second rather than being charged once a month."
              delay={35}
            />

            <ChatMessage
              role="user"
              content="How does this app use it?"
              delay={70}
            />

            <ChatMessage
              role="assistant"
              content="When you subscribe, a stream of 1 USDCx/month flows from your wallet to the DAO. As long as the stream is active, you have access. Stop the stream anytime to cancel - no lock-in, no hassle."
              delay={85}
            />

            {showTyping && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#888" }}>
                <span style={{ fontSize: 14 }}>Venice is typing{".".repeat(typingDots)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
