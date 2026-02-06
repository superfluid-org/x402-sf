import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const ChatMessage: React.FC<{
  role: "user" | "assistant";
  content: string;
  delay: number;
}> = ({ role, content, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const translateY = spring({ frame: frame - delay, fps, from: 20, to: 0, durationInFrames: 20 });

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
          maxWidth: "70%",
          padding: "16px 20px",
          borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
          background: isUser
            ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
            : "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: 18,
          lineHeight: 1.5,
        }}
      >
        {content}
      </div>
    </div>
  );
};

export const ChatDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const typingDots = Math.floor(frame / 10) % 4;
  const showTyping = frame > 180 && frame < 240;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #1f2937 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 60,
      }}
    >
      {/* Title */}
      <div style={{ opacity: titleOpacity, marginBottom: 40 }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, color: "white", margin: 0 }}>
          Venice AI Chat Demo
        </h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
          Subscribers get 10 requests/day to uncensored AI models
        </p>
      </div>

      <div style={{ display: "flex", gap: 40, height: "calc(100% - 200px)" }}>
        {/* Chat window */}
        <div
          style={{
            flex: 2,
            background: "rgba(0,0,0,0.4)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 32,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700,
                color: "white",
              }}
            >
              V
            </div>
            <div>
              <div style={{ color: "white", fontSize: 18, fontWeight: 600 }}>Venice AI</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>llama-3.3-70b</div>
            </div>
            <div style={{ marginLeft: "auto", color: "#10b981", fontSize: 14 }}>
              8 / 10 requests remaining
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <ChatMessage
              role="user"
              content="What is Superfluid and how does money streaming work?"
              delay={60}
            />

            <ChatMessage
              role="assistant"
              content="Superfluid is a protocol for real-time finance on Ethereum. Instead of discrete transfers, money flows continuously by the second. Imagine your salary streaming into your wallet every second rather than arriving once a month!"
              delay={120}
            />

            <ChatMessage
              role="user"
              content="How is this app using Superfluid?"
              delay={240}
            />

            <ChatMessage
              role="assistant"
              content="This app uses Superfluid for subscriptions. When you subscribe, a stream of 1 USDCx/month flows from your wallet to the DAO treasury. As long as the stream is active, you have access. Stop the stream anytime to cancel - no lock-in!"
              delay={300}
            />

            {showTyping && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  V
                </div>
                <span>Typing{".".repeat(typingDots)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Subscription card */}
          <div
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 16,
              padding: 24,
              opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ color: "#10b981", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              SUBSCRIPTION
            </div>
            <div style={{ color: "white", fontSize: 36, fontWeight: 700 }}>
              1 USDCx <span style={{ fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>/ month</span>
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "8px 16px",
                background: "#10b981",
                borderRadius: 8,
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{"\u2713"}</span> Active (1 USDCx/mo)
            </div>
          </div>

          {/* Models card */}
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 24,
              opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              AVAILABLE MODELS
            </div>
            {["Llama 3.3 70B", "DeepSeek V3", "Mistral Large", "Qwen 3 235B"].map((model, i) => (
              <div
                key={model}
                style={{
                  padding: "8px 0",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  color: "white",
                  fontSize: 16,
                }}
              >
                {model}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
