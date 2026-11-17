import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useVideoConfig } from "remotion";
import { S1ColdOpen } from "./scenes/S1ColdOpen";
import { S2Title } from "./scenes/S2Title";
import { S3WhatItIs } from "./scenes/S3WhatItIs";
import { S4Hub } from "./scenes/S4Hub";
import { S5Setup } from "./scenes/S5Setup";
import { S6Breathe } from "./scenes/S6Breathe";
import { S7HandMenu } from "./scenes/S7HandMenu";
import { S8Built } from "./scenes/S8Built";
import { S9Close } from "./scenes/S9Close";
import { CLIP, FADE, SCENE, TOTAL } from "./theme";

/**
 * The app's own sound, taken from recording A (Sunrise Shore session): synthesized waves
 * plus singing bowls. Bowl strikes in A are at 30.3 s, 35.0 s, 39.5 s (opening) and
 * 299 s, 320 s, 324.8 s, 330 s (closing). The bed is aligned so the closing three bowls
 * ring under the end card and the recording's own silence (≈332 s) ends the film.
 */
const BED_START = 151.5;
const TITLE_BOWL = { at: 34.9, length: 5.5, playAt: 15 };

const Soundtrack: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio
        name="Waves + bowls (from recording A)"
        src={staticFile(CLIP.A)}
        trimBefore={Math.round(BED_START * fps)}
        durationInFrames={TOTAL}
        volume={(f) =>
          interpolate(f, [2 * fps, 9 * fps, TOTAL - 2.5 * fps, TOTAL], [0, 0.9, 0.9, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Audio
        name="Title bowl"
        src={staticFile(CLIP.A)}
        from={Math.round(TITLE_BOWL.playAt * fps)}
        trimBefore={Math.round(TITLE_BOWL.at * fps)}
        durationInFrames={Math.round(TITLE_BOWL.length * fps)}
        volume={(f) =>
          interpolate(f, [0, 3, (TITLE_BOWL.length - 1.5) * fps, TITLE_BOWL.length * fps], [0, 0.8, 0.8, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </>
  );
};

const fadeTiming = linearTiming({ durationInFrames: FADE });

export const StillPlacesIntro: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="1 Cold open" durationInFrames={SCENE.coldOpen}>
        <S1ColdOpen />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="2 Title" durationInFrames={SCENE.title}>
        <S2Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="3 What it is" durationInFrames={SCENE.whatItIs}>
        <S3WhatItIs />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="4 Hub" durationInFrames={SCENE.hub}>
        <S4Hub />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="5 Setup" durationInFrames={SCENE.setup}>
        <S5Setup />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="6 Breathe" durationInFrames={SCENE.breathe}>
        <S6Breathe />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="7 Hand menu" durationInFrames={SCENE.handMenu}>
        <S7HandMenu />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="8 How it's built" durationInFrames={SCENE.built}>
        <S8Built />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} />
      <TransitionSeries.Sequence name="9 Close" durationInFrames={SCENE.close}>
        <S9Close />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Soundtrack />
  </AbsoluteFill>
);
