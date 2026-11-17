import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FullBleedClip } from "../components/Footage";
import { Line, Shade } from "../components/Layout";
import { CLIP, FONT, INK } from "../theme";

const STAGES = ["arrive", "settle", "anchor", "practise", "close"];

/** Thin session-progress line in the corner, advancing slowly. */
const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [2 * fps, durationInFrames - fps], [0.42, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const width = 620;
  return (
    <div
      style={{
        position: "absolute",
        right: 120,
        top: 100,
        width,
        opacity: interpolate(frame, [1 * fps, 3 * fps], [0, 0.9], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div style={{ height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 2 }}>
        <div
          style={{
            height: 3,
            width: width * p,
            background: "rgba(255,226,180,0.95)",
            borderRadius: 2,
            boxShadow: "0 0 12px rgba(255,226,180,0.8)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 14,
          fontFamily: FONT,
          fontSize: 30,
          fontWeight: 400,
          color: INK,
          textShadow: "0 1px 12px rgba(0,0,0,0.5)",
        }}
      >
        {STAGES.map((s, i) => (
          <span key={s} style={{ opacity: i / (STAGES.length - 1) <= p + 0.05 ? 1 : 0.6 }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
};

/** 1:25–1:55. The heart of the video: a long, quiet hold on the breathing light. */
export const S6Breathe: React.FC = () => (
  <AbsoluteFill>
    <FullBleedClip src={CLIP.A} at={118} focusY={0.66} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(5,6,10,0.35) 0%, transparent 25%)" }} />
    <Shade strength={0.45} from="left" />
    <Progress />
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 120px" }}>
      <div style={{ maxWidth: 820, textShadow: "0 2px 30px rgba(0,0,0,0.45)" }}>
        <Line from={2} to={12} size={64}>
          A glowing light paces each breath,
        </Line>
        <Line from={3.4} to={12} size={64} soft>
          so you can follow it with your eyes half-closed.
        </Line>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
