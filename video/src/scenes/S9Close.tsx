import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ClipChain } from "../components/ClipChain";
import { FullBleedClip } from "../components/Footage";
import { HeadsetFrame, GlowBackground, Line, Shade } from "../components/Layout";
import { CLIP, FONT, INK_SOFT, PLACE, SITE_URL } from "../theme";

const CARD_AT = 7;
const END_AT = 13.5;

/** White outline that follows the heart's shape: each shadow grows the previous result. */
const QR_BORDER = [
  [5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4], [4, -4], [-4, 4],
]
  .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 white)`)
  .join(" ");

/** 2:35–3:00. Session complete → closing line → end card, rings out to silence. */
export const S9Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence durationInFrames={(CARD_AT + 1) * fps} layout="absolute-fill" name="Session complete">
        <GlowBackground color={PLACE.dawn}>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <HeadsetFrame size={860} color={PLACE.dawn}>
              <ClipChain items={[{ src: CLIP.B, at: 98.8, seconds: 8, rate: 0.6 }]} />
            </HeadsetFrame>
          </AbsoluteFill>
        </GlowBackground>
      </Sequence>
      <Sequence from={CARD_AT * fps} layout="absolute-fill" name="Sunrise">
        <AbsoluteFill
          style={{
            opacity: interpolate(frame, [CARD_AT * fps, (CARD_AT + 1) * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <FullBleedClip
            src={CLIP.A}
            at={165}
            focusY={0.55}
            scale={interpolate(frame, [CARD_AT * fps, durationInFrames], [1.0, 1.06])}
          />
          <Shade strength={0.5} from="all" />
        </AbsoluteFill>
      </Sequence>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: 160,
          textShadow: "0 2px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "grid" }}>
          <Line from={CARD_AT + 1} to={END_AT} size={72} style={{ gridArea: "1 / 1", maxWidth: 1400 }}>
            In VR, what feels calm matters more
            <br />
            than what looks impressive.
          </Line>
          <div style={{ gridArea: "1 / 1", display: "flex", flexDirection: "row", alignItems: "center", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 24, textAlign: "left" }}>
              <Line from={END_AT + 0.4} to={24.5} size={150} style={{ letterSpacing: "0.02em" }}>
                Still Places
              </Line>
              <Line from={END_AT + 1.6} to={24.5} size={48} weight={400}>
                {SITE_URL}
              </Line>
              <Line from={END_AT + 2.4} to={24.5} size={40} soft>
                Runs in any browser · Best in a Quest headset
              </Line>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Line from={END_AT + 2} to={24.5} style={{ filter: "drop-shadow(0 10px 40px rgba(0,0,0,0.45))" }}>
                {/* Heart-shaped QR code for the site; the PNG inside has wide transparent margins. */}
                <Img src={staticFile("qr.svg")} style={{ width: 560, height: 560, display: "block", filter: QR_BORDER }} />
              </Line>
              <Line from={END_AT + 2.8} to={24.5} size={40} weight={400} style={{ marginTop: -70 }}>
                Scan the code
              </Line>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 90 }}>
        <Line
          from={END_AT + 3.2}
          to={24.5}
          size={30}
          soft
          style={{ fontFamily: FONT, color: INK_SOFT, letterSpacing: "0.04em" }}
        >
          Panoramas: Poly Haven (CC0) · Built with Meta&rsquo;s Immersive Web SDK
        </Line>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [durationInFrames - 2.5 * fps, durationInFrames - 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
