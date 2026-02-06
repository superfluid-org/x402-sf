import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const FlywheelStep: React.FC<{
  icon: string;
  title: string;
  description: string;
  delay: number;
  active: boolean;
  position: { x: number; y: number };
}> = ({ icon, title, description, delay, active, position }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const scale = spring({ frame: frame - delay, fps, from: 0.8, to: 1, durationInFrames: 25 });

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: 280,
        opacity,
        transform: `scale(${scale})`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: active
            ? "linear-gradient(135deg, #10b981, #06b6d4)"
            : "rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          margin: "0 auto 16px",
          boxShadow: active ? "0 0 40px rgba(16, 185, 129, 0.4)" : "none",
          transition: "all 0.3s",
        }}
      >
        {icon}
      </div>
      <div style={{ color: "white", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  );
};

const Arrow: React.FC<{ fromX: number; fromY: number; toX: number; toY: number; delay: number; curved?: boolean }> = ({
  fromX,
  fromY,
  toX,
  toY,
  delay,
  curved = false,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const curveOffset = curved ? 50 : 0;

  const pathD = curved
    ? `M ${fromX} ${fromY} Q ${midX} ${midY - curveOffset} ${toX} ${toY}`
    : `M ${fromX} ${fromY} L ${toX} ${toY}`;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
        </marker>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeDasharray="1000"
        strokeDashoffset={1000 - progress * 1000}
        markerEnd={progress > 0.9 ? "url(#arrow)" : undefined}
        opacity={0.6}
      />
    </svg>
  );
};

export const DiemStakingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Animate through the flywheel
  const activeStep = Math.floor(interpolate(frame, [200, 800], [1, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  }));

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #14532d 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 60,
      }}
    >
      {/* Title */}
      <div style={{ opacity: titleOpacity, marginBottom: 20 }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, color: "white", margin: 0 }}>
          Community Flywheel: DIEM Staking
        </h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
          How your subscription grows shared AI infrastructure
        </p>
      </div>

      {/* Flywheel diagram */}
      <div style={{ position: "relative", height: 700, marginTop: 20 }}>
        {/* Center circle */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))",
            border: "2px solid rgba(16, 185, 129, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 48 }}>{"\u267B"}</div>
          <div style={{ color: "white", fontSize: 18, fontWeight: 600, marginTop: 8 }}>
            Community
          </div>
          <div style={{ color: "white", fontSize: 18, fontWeight: 600 }}>Flywheel</div>
        </div>

        {/* Steps around the circle */}
        <FlywheelStep
          icon={"\uD83D\uDCB3"}
          title="User Subscribes"
          description="1 USDCx/month streams to DAO Treasury"
          delay={60}
          active={activeStep === 1}
          position={{ x: 150, y: 100 }}
        />

        <FlywheelStep
          icon={"\uD83C\uDFE6"}
          title="DAO Treasury"
          description="Accumulates subscription revenue"
          delay={120}
          active={activeStep === 2}
          position={{ x: 700, y: 100 }}
        />

        <FlywheelStep
          icon={"\uD83D\uDECD\uFE0F"}
          title="Buy DIEM"
          description="Treasury uses funds to purchase DIEM tokens"
          delay={180}
          active={activeStep === 3}
          position={{ x: 900, y: 400 }}
        />

        <FlywheelStep
          icon={"\uD83D\uDD12"}
          title="Stake DIEM"
          description="Stake in Venice protocol for API access"
          delay={240}
          active={activeStep === 4}
          position={{ x: 700, y: 650 }}
        />

        <FlywheelStep
          icon={"\u26A1"}
          title="More Compute"
          description="Higher stake = more daily API allocation"
          delay={300}
          active={activeStep === 5}
          position={{ x: 150, y: 650 }}
        />

        <FlywheelStep
          icon={"\uD83D\uDE80"}
          title="Better Service"
          description="More capacity attracts more subscribers!"
          delay={360}
          active={activeStep >= 6}
          position={{ x: -50, y: 400 }}
        />

        {/* Arrows connecting steps */}
        <Arrow fromX={350} fromY={180} toX={700} toY={180} delay={90} />
        <Arrow fromX={880} fromY={200} toX={980} toY={400} delay={150} curved />
        <Arrow fromX={980} fromY={500} toX={880} toY={700} delay={210} curved />
        <Arrow fromX={700} fromY={750} toX={350} toY={750} delay={270} />
        <Arrow fromX={230} fromY={700} toX={130} toY={500} delay={330} curved />
        <Arrow fromX={130} fromY={400} toX={230} toY={200} delay={390} curved />
      </div>

      {/* Bottom highlight */}
      {frame > 500 && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 60,
            right: 60,
            padding: 24,
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 12,
            opacity: interpolate(frame, [500, 530], [0, 1], { extrapolateRight: "clamp" }),
            display: "flex",
            justifyContent: "space-around",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#10b981", fontSize: 28, fontWeight: 700 }}>Fair Access</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Everyone pays the same flat rate
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#10b981", fontSize: 28, fontWeight: 700 }}>Shared Growth</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              More subscribers = more compute for all
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#10b981", fontSize: 28, fontWeight: 700 }}>Cancel Anytime</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Stop your stream via Superfluid dashboard
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
