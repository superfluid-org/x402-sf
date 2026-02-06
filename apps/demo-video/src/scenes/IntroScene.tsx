import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame, fps, from: 50, to: 0, durationInFrames: 45 });

  const subtitleOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = spring({ frame: frame - 30, fps, from: 30, to: 0, durationInFrames: 45 });

  const taglineOpacity = interpolate(frame, [90, 120], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Glowing orb */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* x402 + Superfluid */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <span
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            x402
          </span>
          <span
            style={{
              fontSize: 120,
              fontWeight: 300,
              color: "#6366f1",
              marginLeft: 30,
            }}
          >
            +
          </span>
          <span
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: "#10b981",
              marginLeft: 30,
            }}
          >
            Superfluid
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            marginTop: 40,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontWeight: 400,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            Community-Powered AI Infrastructure
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOpacity,
            marginTop: 60,
            display: "flex",
            gap: 40,
            justifyContent: "center",
          }}
        >
          {["Stream Payments", "No Gas Fees", "DAO Owned"].map((tag, i) => (
            <div
              key={tag}
              style={{
                padding: "12px 24px",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                color: "rgba(255,255,255,0.7)",
                fontSize: 24,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
