import { AbsoluteFill, Sequence } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { FlowScene } from "./scenes/FlowScene";
import { ChatDemoScene } from "./scenes/ChatDemoScene";
import { OutroScene } from "./scenes/OutroScene";

// Scene durations in frames (30fps)
// Total: 25 seconds = 750 frames
const SCENES = {
  intro: { start: 0, duration: 120 }, // 4 sec - Logo reveal + title
  architecture: { start: 120, duration: 150 }, // 5 sec - Old vs new comparison
  flow: { start: 270, duration: 180 }, // 6 sec - How it works steps
  chatDemo: { start: 450, duration: 180 }, // 6 sec - Venice AI chat demo
  outro: { start: 630, duration: 120 }, // 4 sec - CTA with logos
};

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <Sequence from={SCENES.intro.start} durationInFrames={SCENES.intro.duration}>
        <IntroScene />
      </Sequence>

      <Sequence from={SCENES.architecture.start} durationInFrames={SCENES.architecture.duration}>
        <ArchitectureScene />
      </Sequence>

      <Sequence from={SCENES.flow.start} durationInFrames={SCENES.flow.duration}>
        <FlowScene />
      </Sequence>

      <Sequence from={SCENES.chatDemo.start} durationInFrames={SCENES.chatDemo.duration}>
        <ChatDemoScene />
      </Sequence>

      <Sequence from={SCENES.outro.start} durationInFrames={SCENES.outro.duration}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
