import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";

type Clip = {
  /** Path under public/, e.g. CLIP.A */
  src: string;
  /** Where in the recording to start, in seconds. */
  at: number;
  /** Playback speed. Below 1 slows the headset motion down. */
  rate?: number;
};

/** A square headset recording, muted and drawn to fill its parent square. */
export const SquareClip: React.FC<Clip & { style?: React.CSSProperties }> = ({
  src,
  at,
  rate = 1,
  style,
}) => {
  const { fps } = useVideoConfig();
  return (
    <Video
      src={staticFile(src)}
      trimBefore={Math.round(at * fps)}
      playbackRate={rate}
      muted
      objectFit="cover"
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
};

/**
 * Full-bleed 16:9 crop of a square recording.
 * `focusY` (0–1) picks which horizontal band of the square stays in view.
 */
export const FullBleedClip: React.FC<
  Clip & { focusY?: number; scale?: number; children?: React.ReactNode }
> = ({ src, at, rate = 1, focusY = 0.5, scale = 1, children }) => {
  const { width, height } = useVideoConfig();
  const side = width;
  const top = Math.min(0, Math.max(height - side, height / 2 - side * focusY));
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <AbsoluteFill style={{ scale: String(scale) }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top,
            width: side,
            height: side,
          }}
        >
          <SquareClip src={src} at={at} rate={rate} />
        </div>
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};
