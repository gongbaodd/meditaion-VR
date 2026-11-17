import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SquareClip } from "../components/Footage";
import { GlowBackground, Line } from "../components/Layout";
import { CLIP, FONT, INK, PLACE } from "../theme";

const TILES = [
  { name: "Mountain Dawn", color: PLACE.dawn, src: CLIP.B, at: 60 },
  { name: "Forest Light", color: PLACE.forest, src: CLIP.B, at: 118.5 },
  { name: "Alpine Meadow", color: PLACE.meadow, src: CLIP.A, at: 346.5 },
];

const CHIPS = ["WebXR", "No install", "No account"];

/** 0:25–0:45. Three places side by side, plus the one-line pitch. */
export const S3WhatItIs: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <GlowBackground color={PLACE.beach}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          padding: "90px 120px",
        }}
      >
        <Line from={0.4} size={64} style={{ textAlign: "center", maxWidth: 1500 }}>
          A meditation website that runs in a VR headset
          <span style={{ opacity: 0.6 }}> — or in any browser tab.</span>
        </Line>
        <div style={{ display: "flex", gap: 56 }}>
          {TILES.map((t, i) => {
            const start = (1.6 + i * 0.6) * fps;
            return (
              <div
                key={t.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 22,
                  opacity: interpolate(frame, [start, start + fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  translate: interpolate(frame, [start, start + fps], ["0px 30px", "0px 0px"], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }),
                }}
              >
                <div
                  style={{
                    width: 470,
                    height: 470,
                    borderRadius: 36,
                    overflow: "hidden",
                    boxShadow: `0 24px 90px ${t.color}38, 0 0 0 1px rgba(255,255,255,0.08)`,
                  }}
                >
                  <SquareClip src={t.src} at={t.at} rate={0.5} />
                </div>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 38,
                    fontWeight: 400,
                    color: INK,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background: t.color,
                      boxShadow: `0 0 16px ${t.color}`,
                    }}
                  />
                  {t.name}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {CHIPS.map((c, i) => {
            const start = (5 + i * 0.5) * fps;
            return (
              <div
                key={c}
                style={{
                  fontFamily: FONT,
                  fontSize: 40,
                  fontWeight: 400,
                  color: INK,
                  padding: "14px 36px",
                  borderRadius: 999,
                  border: "1.5px solid rgba(255,214,160,0.45)",
                  background: "rgba(255,214,160,0.08)",
                  opacity: interpolate(frame, [start, start + 0.8 * fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </GlowBackground>
  );
};
