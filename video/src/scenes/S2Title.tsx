import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FullBleedClip } from "../components/Footage";
import { Line, Shade } from "../components/Layout";
import { CLIP } from "../theme";

/** 0:15–0:25. Title over a slow push-in on the beach. First bowl rings (see Soundtrack). */
export const S2Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <FullBleedClip
        src={CLIP.A}
        at={150}
        focusY={0.55}
        scale={interpolate(frame, [0, durationInFrames], [1, 1.08])}
      />
      <Shade strength={0.45} from="all" />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 28,
          textShadow: "0 2px 40px rgba(0,0,0,0.45)",
        }}
      >
        <Line
          from={0.6}
          size={170}
          style={{ letterSpacing: "0.02em" }}
        >
          Still Places
        </Line>
        <Line from={2.2} size={60} soft>
          Sit somewhere beautiful and breathe.
        </Line>
        <div
          style={{
            width: interpolate(frame, [1.2 * fps, 4 * fps], [0, 260], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 2,
            background: "rgba(255,214,160,0.8)",
            marginTop: 12,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
