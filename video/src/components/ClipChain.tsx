import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SquareClip } from "./Footage";

type ChainItem = { src: string; at: number; seconds: number; rate?: number };

const FadeIn: React.FC<{ frames: number; children: React.ReactNode }> = ({
  frames,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity:
          frames === 0
            ? 1
            : interpolate(frame, [0, frames], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Plays square clips back to back inside one frame, each cross-fading over the last.
 * The last clip runs to the end of the scene.
 */
export const ClipChain: React.FC<{ items: ChainItem[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  const xfade = Math.round(0.6 * fps);
  let start = 0;
  return (
    <AbsoluteFill>
      {items.map((item, i) => {
        const from = start;
        start += Math.round(item.seconds * fps);
        const last = i === items.length - 1;
        return (
          <Sequence
            key={i}
            name={`Clip ${i + 1}`}
            from={from}
            durationInFrames={last ? undefined : start - from + xfade}
            layout="absolute-fill"
            premountFor={fps}
          >
            <FadeIn frames={i === 0 ? 0 : xfade}>
              <SquareClip src={item.src} at={item.at} rate={item.rate} />
            </FadeIn>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
