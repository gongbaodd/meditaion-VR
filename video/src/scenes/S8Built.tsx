import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FullBleedClip } from "../components/Footage";
import { Line } from "../components/Layout";
import { CLIP, FONT, INK, INK_SOFT } from "../theme";

const CARDS = [
  { title: "Meta Immersive Web SDK", body: "TypeScript, Vite and an entity-component system" },
  { title: "Poly Haven CC0 panoramas", body: "Pre-built as compressed cube maps" },
  { title: "UIKitML spatial panels", body: "Plus an HTML overlay for flat screens" },
  { title: "Web Audio", body: "Every bell and ambience is synthesized. No audio files." },
];

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const CARDS_OUT = 12.5;
const BARS_IN = 13.2;

const Card: React.FC<{ i: number; title: string; body: string }> = ({ i, title, body }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (1.5 + i * 1.6) * fps;
  return (
    <div
      style={{
        padding: "40px 48px",
        borderRadius: 32,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(8px)",
        opacity: interpolate(frame, [s, s + fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        }),
        translate: interpolate(frame, [s, s + fps], ["0px 24px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        }),
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 48, fontWeight: 600, color: INK }}>{title}</div>
      <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 300, color: INK_SOFT, marginTop: 12 }}>
        {body}
      </div>
    </div>
  );
};

/** GPU texture memory after 18 place switches, from docs/plan/performance.md. */
const MemoryBars: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = BARS_IN * fps;
  const max = 1300;
  const before = 5221;
  const after = 93;
  const shrink = interpolate(frame, [s + 2 * fps, s + 4.5 * fps], [before, after], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const row = (label: string, value: number, color: string, delay: number, shown: number) => (
    <div
      style={{
        opacity: interpolate(frame, [s + delay * fps, s + (delay + 0.8) * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 36, fontWeight: 400, color: INK_SOFT, marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            height: 44,
            width: Math.max(10, (value / before) * max),
            borderRadius: 10,
            background: color,
          }}
        />
        <div style={{ fontFamily: FONT, fontSize: 52, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(shown).toLocaleString("en-US")} MiB
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 160px",
        gap: 56,
        opacity: interpolate(frame, [s, s + 0.6 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <Line from={BARS_IN + 0.2} size={64}>
        GPU memory after 18 place changes
      </Line>
      {row("First version: JPG panoramas, never freed", before, "rgba(255,140,120,0.85)", 0.6, before)}
      {row("Now: compressed cube maps, freed on every change", shrink, "rgba(255,214,160,0.95)", 1.6, frame < s + 2 * fps ? before : shrink)}
      <Line from={BARS_IN + 6} size={56} soft>
        Measure before you guess.
      </Line>
    </AbsoluteFill>
  );
};

/** 2:10–2:35. How it's built, then the GPU-memory story. */
export const S8Built: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#07080c" }}>
      <AbsoluteFill style={{ opacity: 0.22, filter: "blur(18px)" }}>
        <FullBleedClip src={CLIP.A} at={220} focusY={0.55} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(7,8,12,0.45)" }} />
      <AbsoluteFill
        style={{
          padding: "110px 160px",
          gap: 48,
          opacity: interpolate(frame, [(CARDS_OUT - 0.8) * fps, CARDS_OUT * fps], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Line from={0.3} size={44} weight={400} soft style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
          How it&rsquo;s built
        </Line>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {CARDS.map((c, i) => (
            <Card key={c.title} i={i} {...c} />
          ))}
        </div>
      </AbsoluteFill>
      <MemoryBars />
    </AbsoluteFill>
  );
};
