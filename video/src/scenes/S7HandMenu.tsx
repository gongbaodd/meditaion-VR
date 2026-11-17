import React from "react";
import { ClipChain } from "../components/ClipChain";
import { Line, SplitLayout } from "../components/Layout";
import { CLIP, PLACE } from "../theme";

/** 1:55–2:10. Palm toward the face → hand menu; pause. */
export const S7HandMenu: React.FC = () => (
  <SplitLayout
    color={PLACE.dawn}
    frame={
      <ClipChain
        items={[
          { src: CLIP.B, at: 17, seconds: 10 },
          { src: CLIP.B, at: 92.5, seconds: 7 },
        ]}
      />
    }
    text={
      <>
        <Line from={0.6} size={72}>
          Turn your palm toward you for a menu.
        </Line>
        <Line from={2.6} size={52} soft>
          Pause, change the length or start a session.
        </Line>
        <Line from={4.4} size={52} weight={400} style={{ color: "#ffd6a6" }}>
          No controllers needed.
        </Line>
      </>
    }
  />
);
