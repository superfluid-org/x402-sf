import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame, fps, from: 0.9, to: 1, durationInFrames: 40 });

  const bulletDelay = (i: number) => 40 + i * 20;

  const bullets = [
    { icon: "\u26A1", text: "x402 + Superfluid = Seamless streaming payments" },
    { icon: "\u270D\uFE0F", text: "Users sign, not pay gas" },
    { icon: "\uD83C\uDFDB\uFE0F", text: "Community-owned AI infrastructure" },
    { icon: "\uD83D\uDCB8", text: "1 USDCx/month streams to DAO" },
  ];

  const ctaOpacity = interpolate(frame, [160, 180], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: frame - 160, fps, from: 0.9, to: 1, durationInFrames: 30 });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background effects */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1, maxWidth: 1200 }}>
        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            marginBottom: 60,
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              margin: 0,
            }}
          >
            Ready to{" "}
            <span style={{ color: "#10b981" }}>Stream</span>?
          </h1>
        </div>

        {/* Recap bullets */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 24,
            marginBottom: 60,
          }}
        >
          {bullets.map((bullet, i) => {
            const opacity = interpolate(frame, [bulletDelay(i), bulletDelay(i) + 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            });
            const y = spring({
              frame: frame - bulletDelay(i),
              fps,
              from: 20,
              to: 0,
              durationInFrames: 25
            });

            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${y}px)`,
                  padding: "16px 24px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>{bullet.icon}</span>
                <span style={{ color: "white", fontSize: 18 }}>{bullet.text}</span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "24px 64px",
              background: "linear-gradient(135deg, #10b981, #06b6d4)",
              borderRadius: 16,
              boxShadow: "0 0 60px rgba(16, 185, 129, 0.4)",
            }}
          >
            <div style={{ color: "white", fontSize: 32, fontWeight: 700 }}>
              Try it now
            </div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 18, marginTop: 8 }}>
              /demo/chat
            </div>
          </div>

          {/* Logos */}
          <div
            style={{
              marginTop: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 40,
            }}
          >
            <span style={{ color: "white", fontSize: 28, fontWeight: 700 }}>x402</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 28 }}>+</span>
            <span style={{ color: "#10b981", fontSize: 28, fontWeight: 700 }}>Superfluid</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 28 }}>+</span>
            <span style={{ color: "#06b6d4", fontSize: 28, fontWeight: 700 }}>Venice AI</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
