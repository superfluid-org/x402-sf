import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const SupRewardsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const badgeScale = spring({ frame, fps, from: 0.5, to: 1, durationInFrames: 30 });

  const titleOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame: frame - 30, fps, from: 30, to: 0, durationInFrames: 30 });

  const contentOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  const pulse = Math.sin(frame / 15) * 0.05 + 1;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #312e81 50%, #1e1b4b 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Animated background particles */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 30% 40%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
                       radial-gradient(circle at 70% 60%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)`,
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* Coming Soon Badge */}
        <div
          style={{
            opacity: badgeOpacity,
            transform: `scale(${badgeScale * pulse})`,
            display: "inline-block",
            padding: "12px 32px",
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            borderRadius: 100,
            marginBottom: 40,
            boxShadow: "0 0 60px rgba(139, 92, 246, 0.5)",
          }}
        >
          <span style={{ color: "white", fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>
            COMING SOON
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <h1
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "white",
              margin: 0,
              marginBottom: 20,
            }}
          >
            Earn{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #a78bfa, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SUP Rewards
            </span>
          </h1>
        </div>

        {/* Content */}
        <div style={{ opacity: contentOpacity, maxWidth: 800, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.6,
              marginBottom: 48,
            }}
          >
            As part of Superfluid's marketing campaign, subscribers will be eligible for{" "}
            <strong style={{ color: "#a78bfa" }}>SUP token rewards</strong> in the next season.
          </p>

          {/* Highlight box */}
          <div
            style={{
              padding: 32,
              background: "rgba(139, 92, 246, 0.1)",
              border: "2px solid rgba(139, 92, 246, 0.4)",
              borderRadius: 16,
              display: "inline-block",
            }}
          >
            <div style={{ fontSize: 24, color: "white", fontWeight: 600 }}>
              {"\uD83C\uDF1F"} Early subscribers will be rewarded
            </div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
              Subscribe now to be eligible when rewards go live
            </div>
          </div>
        </div>
      </div>

      {/* Floating SUP tokens */}
      {[...Array(6)].map((_, i) => {
        const delay = i * 20;
        const x = 150 + i * 300;
        const y = 200 + Math.sin(frame / 30 + i) * 50;
        const opacity = interpolate(frame, [delay + 100, delay + 130], [0, 0.3], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #a78bfa, #6366f1)",
              opacity,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "white",
              boxShadow: "0 0 30px rgba(139, 92, 246, 0.5)",
            }}
          >
            S
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
