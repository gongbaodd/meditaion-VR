import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FullBleedClip } from "../components/Footage";
import { Line, Shade } from "../components/Layout";
import { CLIP, NIGHT } from "../theme";

/** 0:00–0:15. The story on black, then Sunrise Shore fades in. */
export const S1ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [6.5 * fps, 9.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <FullBleedClip src={CLIP.A} at={135} focusY={0.55} />
        <Shade strength={0.55} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", padding: 160 }}
      >
        <div style={{ display: "grid", textAlign: "center", maxWidth: 1400 }}>
          <Line from={0.8} to={6.6} size={72} style={{ gridArea: "1 / 1" }}>
            In the middle of a dark winter,
            <br />I caught a bad cold.
          </Line>
          <Line from={8} to={14.6} size={72} style={{ gridArea: "1 / 1", textShadow: "0 2px 30px rgba(0,0,0,0.5)" }}>
            I couldn&rsquo;t travel.
            <br />
            But I had a headset.
          </Line>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
