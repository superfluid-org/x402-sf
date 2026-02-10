import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame, fps, from: 0.9, to: 1, durationInFrames: 25 });

  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = spring({ frame: frame - 30, fps, from: 20, to: 0, durationInFrames: 20 });

  return (
    <AbsoluteFill
      style={{
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        justifyContent: "center",
        alignItems: "center",
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

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* Big title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}
        >
          <h1
            style={{
              fontSize: 96,
              fontWeight: 400,
              color: "black",
              margin: 0,
              fontFamily: "'Instrument Serif', Georgia, serif",
              letterSpacing: "-0.02em",
            }}
          >
            Ready to subscribe?
          </h1>
        </div>

        {/* Button */}
        <div
          style={{
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            marginTop: 50,
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "24px 48px",
              background: "black",
              color: "white",
              fontSize: 28,
              fontWeight: 500,
            }}
          >
            Visit x402.superfluid.org and try it out
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
