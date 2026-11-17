import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ClipChain } from "../components/ClipChain";
import { Line, SplitLayout, Stack, stackCell } from "../components/Layout";
import { CLIP, FONT, INK, PLACE, PLACE_LIST } from "../theme";

/** The six places, lighting up one by one. */
const PlaceDots: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [(to - 1) * fps, to * fps], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "18px 40px",
        marginTop: 20,
        opacity: out,
      }}
    >
      {PLACE_LIST.map((p, i) => {
        const s = (from + i * 0.45) * fps;
        const on = interpolate(frame, [s, s + 0.6 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={p.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontFamily: FONT,
              fontSize: 38,
              fontWeight: 300,
              color: INK,
              opacity: 0.25 + on * 0.75,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: p.color,
                boxShadow: `0 0 ${on * 22}px ${p.color}`,
                opacity: 0.3 + on * 0.7,
              }}
            />
            {p.name}
          </div>
        );
      })}
    </div>
  );
};

/** 0:45–1:10. The hub: ring of windows, dial, fade-and-swap. */
export const S4Hub: React.FC = () => (
  <SplitLayout
    color={PLACE.night}
    frame={
      <ClipChain
        items={[
          { src: CLIP.B, at: 3, seconds: 9 },
          { src: CLIP.A, at: 427, seconds: 17 },
        ]}
      />
    }
    text={
      <Stack>
        <div style={{ ...stackCell, display: "flex", flexDirection: "column" }}>
          <Line from={0.6} to={9} size={64}>
            Six places, each a full 360° panorama.
          </Line>
          <PlaceDots from={2} to={9} />
        </div>
        <Line from={9.4} to={17} size={64} style={stackCell}>
          Turn the dial to browse.
          <br />
          Step through a window to enter.
        </Line>
        <div style={{ ...stackCell, display: "flex", flexDirection: "column", gap: 28 }}>
          <Line from={17.4} size={64}>
            Nothing slides past you.
          </Line>
          <Line from={18.6} size={48} soft>
            Windows fade and swap while nothing is visible, so the hub stays comfortable.
          </Line>
        </div>
      </Stack>
    }
  />
);
