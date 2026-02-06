import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";

// 30 fps, each scene has defined duration
// Total: ~8 minutes = 480 seconds = 14400 frames at 30fps
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={14400}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
