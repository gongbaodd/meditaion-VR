import React from "react";
import { Composition, Folder } from "remotion";
import { S1ColdOpen } from "./scenes/S1ColdOpen";
import { S2Title } from "./scenes/S2Title";
import { S3WhatItIs } from "./scenes/S3WhatItIs";
import { S4Hub } from "./scenes/S4Hub";
import { S5Setup } from "./scenes/S5Setup";
import { S6Breathe } from "./scenes/S6Breathe";
import { S7HandMenu } from "./scenes/S7HandMenu";
import { S8Built } from "./scenes/S8Built";
import { S9Close } from "./scenes/S9Close";
import { StillPlacesIntro } from "./StillPlacesIntro";
import { FPS, HEIGHT, SCENE, TOTAL, WIDTH } from "./theme";

const scenes = [
  { id: "S1-ColdOpen", component: S1ColdOpen, d: SCENE.coldOpen },
  { id: "S2-Title", component: S2Title, d: SCENE.title },
  { id: "S3-WhatItIs", component: S3WhatItIs, d: SCENE.whatItIs },
  { id: "S4-Hub", component: S4Hub, d: SCENE.hub },
  { id: "S5-Setup", component: S5Setup, d: SCENE.setup },
  { id: "S6-Breathe", component: S6Breathe, d: SCENE.breathe },
  { id: "S7-HandMenu", component: S7HandMenu, d: SCENE.handMenu },
  { id: "S8-Built", component: S8Built, d: SCENE.built },
  { id: "S9-Close", component: S9Close, d: SCENE.close },
];

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="StillPlacesIntro"
      component={StillPlacesIntro}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={TOTAL}
    />
    <Folder name="Scenes">
      {scenes.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={s.component}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={s.d}
        />
      ))}
    </Folder>
  </>
);
