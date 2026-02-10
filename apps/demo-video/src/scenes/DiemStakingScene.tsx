import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const CircleStep: React.FC<{
  label: string;
  angle: number;
  delay: number;
  active: boolean;
  radius: number;
}> = ({ label, angle, delay, active, radius }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const scale = spring({ frame: frame - delay, fps, from: 0.8, to: 1, durationInFrames: 12 });

  // Position on circle
  const radians = (angle - 90) * (Math.PI / 180);
  const x = Math.cos(radians) * radius;
  const y = Math.sin(radians) * radius;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`,
        opacity,
        padding: "16px 24px",
        background: active ? "black" : "white",
        color: active ? "white" : "black",
        border: "2px solid black",
        fontSize: 18,
        fontWeight: 600,
        whiteSpace: "nowrap",
        textAlign: "center",
      }}
    >
      {label}
    </div>
  );
};

export const DiemStakingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame, fps, from: 15, to: 0, durationInFrames: 15 });

  // Animate which step is active
  const activeStep = Math.floor(interpolate(frame, [30, 100], [0, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  }));

  // Arrow animation
  const arrowProgress = interpolate(frame, [25, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const radius = 220;

  return (
    <AbsoluteFill
      style={{
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
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

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          paddingTop: 60,
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
          }}
        >
          Community Flywheel
        </h1>
      </div>

      {/* Circle diagram */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -40%)",
          width: radius * 2 + 200,
          height: radius * 2 + 200,
        }}
      >
        {/* Circular arrow path */}
        <svg
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: radius * 2 + 40,
            height: radius * 2 + 40,
          }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="black" />
            </marker>
          </defs>
          <circle
            cx="50%"
            cy="50%"
            r={radius - 30}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={2}
            strokeDasharray={`${2 * Math.PI * (radius - 30)}`}
            strokeDashoffset={2 * Math.PI * (radius - 30) * (1 - arrowProgress)}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
          />
        </svg>

        {/* Steps positioned around circle */}
        <CircleStep
          label="You subscribe"
          angle={0}
          delay={10}
          active={activeStep === 0}
          radius={radius}
        />
        <CircleStep
          label="Access AI chat"
          angle={90}
          delay={20}
          active={activeStep === 1}
          radius={radius}
        />
        <CircleStep
          label="DAO buys DIEM"
          angle={180}
          delay={30}
          active={activeStep === 2}
          radius={radius}
        />
        <CircleStep
          label="More usage for all"
          angle={270}
          delay={40}
          active={activeStep === 3}
          radius={radius}
        />

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            opacity: interpolate(frame, [50, 60], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ fontSize: 32, color: "#888" }}>↻</div>
          <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>cycle</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
