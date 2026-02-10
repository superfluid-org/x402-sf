import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";

// 30 fps
// Total: 25 seconds = 750 frames at 30fps
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={750}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
