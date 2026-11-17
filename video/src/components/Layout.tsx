import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT, INK, INK_SOFT, NIGHT } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Dark background with a slow-drifting glow in the place colour. */
export const GlowBackground: React.FC<{
  color: string;
  children?: React.ReactNode;
}> = ({ color, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x = 30 + Math.sin(t / 7) * 12;
  const y = 40 + Math.cos(t / 9) * 10;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: NIGHT,
        backgroundImage: `radial-gradient(ellipse 70% 80% at ${x}% ${y}%, ${color}2e 0%, ${color}0d 45%, transparent 75%), radial-gradient(ellipse 60% 60% at ${100 - x}% ${100 - y / 2}%, ${color}14 0%, transparent 70%)`,
        fontFamily: FONT,
        color: INK,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Rounded square "headset view" with a soft coloured glow and a slow breathing scale. */
export const HeadsetFrame: React.FC<{
  size: number;
  color: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ size, color, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 44,
        overflow: "hidden",
        position: "relative",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 30px 120px ${color}40, 0 10px 40px rgba(0,0,0,0.6)`,
        opacity: interpolate(frame, [0, 0.8 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        }),
        scale: String(
          interpolate(frame, [0, 1.2 * fps], [0.96, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          }),
        ),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Text that fades and drifts up in at `from` and fades out at `to` (both in seconds,
 * scene-relative). Leave `to` out to keep it on screen until the scene ends.
 */
export const Line: React.FC<{
  from: number;
  to?: number;
  size?: number;
  weight?: 300 | 400 | 600;
  soft?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ from, to, size = 60, weight = 300, soft, style, children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inA = from * fps;
  const inB = inA + 1.2 * fps;
  const outB = to === undefined ? durationInFrames + 100 : to * fps;
  const outA = outB - 1.0 * fps;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.3,
        letterSpacing: "-0.005em",
        color: soft ? INK_SOFT : INK,
        textWrap: "balance",
        opacity: interpolate(frame, [inA, inB, outA, outB], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        }),
        translate: interpolate(frame, [inA, inB], ["0px 18px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Bottom-to-top shade so text over footage stays legible. */
export const Shade: React.FC<{
  strength?: number;
  from?: "bottom" | "left" | "all";
}> = ({ strength = 0.6, from = "bottom" }) => {
  const bg =
    from === "all"
      ? `rgba(5,6,10,${strength})`
      : from === "left"
        ? `linear-gradient(to right, rgba(5,6,10,${strength}) 0%, rgba(5,6,10,${strength * 0.6}) 40%, transparent 75%)`
        : `linear-gradient(to top, rgba(5,6,10,${strength}) 0%, rgba(5,6,10,${strength * 0.5}) 35%, transparent 65%)`;
  return <AbsoluteFill style={{ background: bg }} />;
};

/**
 * Standard two-column layout: text on the left, headset frame on the right.
 */
export const SplitLayout: React.FC<{
  color: string;
  text: React.ReactNode;
  frame: React.ReactNode;
}> = ({ color, text, frame }) => (
  <GlowBackground color={color}>
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: "0 120px",
        gap: 90,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 36,
          position: "relative",
          minHeight: 600,
          justifyContent: "center",
        }}
      >
        {text}
      </div>
      <HeadsetFrame size={800} color={color}>
        {frame}
      </HeadsetFrame>
    </AbsoluteFill>
  </GlowBackground>
);

/** Several lines that replace one another in the same spot. */
export const Stack: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div style={{ display: "grid", alignItems: "center" }}>{children}</div>;

/** Put children of a <Stack> on top of one another. */
export const stackCell: React.CSSProperties = { gridArea: "1 / 1" };
