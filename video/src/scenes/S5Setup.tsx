import React from "react";
import { ClipChain } from "../components/ClipChain";
import { Line, SplitLayout } from "../components/Layout";
import { CLIP, PLACE } from "../theme";

/** 1:10–1:25. The setup panel: length and sound. */
export const S5Setup: React.FC = () => (
  <SplitLayout
    color={PLACE.beach}
    frame={<ClipChain items={[{ src: CLIP.B, at: 185.5, seconds: 16, rate: 0.68 }]} />}
    text={
      <>
        <Line from={0.6} size={88} weight={300}>
          3, 5, 10 or 20&nbsp;minutes.
        </Line>
        <Line from={2.4} size={56} soft>
          Rain, forest, waves, stream or night.
        </Line>
        <Line from={5.5} size={44} soft style={{ marginTop: 24 }}>
          Every session has the same shape:
          <br />
          arrive → settle → anchor → practise → close.
        </Line>
      </>
    }
  />
);
