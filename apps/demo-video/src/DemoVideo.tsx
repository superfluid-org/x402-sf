import { AbsoluteFill, Sequence } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { ContractScene } from "./scenes/ContractScene";
import { FlowScene } from "./scenes/FlowScene";
import { ChatDemoScene } from "./scenes/ChatDemoScene";
import { DiemStakingScene } from "./scenes/DiemStakingScene";
import { SupRewardsScene } from "./scenes/SupRewardsScene";
import { OutroScene } from "./scenes/OutroScene";

// Scene durations in frames (30fps)
const SCENES = {
  intro: { start: 0, duration: 300 }, // 10 sec
  architecture: { start: 300, duration: 900 }, // 30 sec
  contract: { start: 1200, duration: 600 }, // 20 sec
  flow: { start: 1800, duration: 900 }, // 30 sec
  chatDemo: { start: 2700, duration: 600 }, // 20 sec
  diemStaking: { start: 3300, duration: 900 }, // 30 sec
  supRewards: { start: 4200, duration: 300 }, // 10 sec
  outro: { start: 4500, duration: 300 }, // 10 sec
};

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <Sequence from={SCENES.intro.start} durationInFrames={SCENES.intro.duration}>
        <IntroScene />
      </Sequence>

      <Sequence from={SCENES.architecture.start} durationInFrames={SCENES.architecture.duration}>
        <ArchitectureScene />
      </Sequence>

      <Sequence from={SCENES.contract.start} durationInFrames={SCENES.contract.duration}>
        <ContractScene />
      </Sequence>

      <Sequence from={SCENES.flow.start} durationInFrames={SCENES.flow.duration}>
        <FlowScene />
      </Sequence>

      <Sequence from={SCENES.chatDemo.start} durationInFrames={SCENES.chatDemo.duration}>
        <ChatDemoScene />
      </Sequence>

      <Sequence from={SCENES.diemStaking.start} durationInFrames={SCENES.diemStaking.duration}>
        <DiemStakingScene />
      </Sequence>

      <Sequence from={SCENES.supRewards.start} durationInFrames={SCENES.supRewards.duration}>
        <SupRewardsScene />
      </Sequence>

      <Sequence from={SCENES.outro.start} durationInFrames={SCENES.outro.duration}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
