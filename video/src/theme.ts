import { loadFont } from "@remotion/google-fonts/NotoSans";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "600"],
  subsets: ["latin"],
});

export const FONT = fontFamily;
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Length of the cross-fade between scenes, in frames. */
export const FADE = 30;

/** Change this once the site has its public domain. */
export const SITE_URL = "still-places.growgen.xyz";

export const INK = "#f4efe6";
export const INK_SOFT = "rgba(244, 239, 230, 0.72)";
export const NIGHT = "#0b0d12";

/** Place colours, from src/data/places.json in the app. */
export const PLACE = {
  dawn: "#ff9d6c",
  forest: "#7fd08a",
  lake: "#6fc3d9",
  beach: "#ffc46b",
  meadow: "#b9e36b",
  night: "#7d8cff",
} as const;

export const PLACE_LIST: { name: string; color: string }[] = [
  { name: "Mountain Dawn", color: PLACE.dawn },
  { name: "Forest Light", color: PLACE.forest },
  { name: "Lakeside", color: PLACE.lake },
  { name: "Sunrise Shore", color: PLACE.beach },
  { name: "Alpine Meadow", color: PLACE.meadow },
  { name: "Starry Night", color: PLACE.night },
];

/**
 * Headset recordings, re-encoded to H.264 30 fps 1080×1080 from docs/records/.
 * A = Sunrise Shore session + hub tour, B = hub → Mountain Dawn, Forest Light, setup panel.
 */
export const CLIP = {
  A: "footage/A.mp4",
  B: "footage/B.mp4",
} as const;

/** Scene lengths in frames, including the FADE overlap with the next scene. */
export const SCENE = {
  coldOpen: 480,
  title: 330,
  whatItIs: 630,
  hub: 780,
  setup: 480,
  breathe: 930,
  handMenu: 480,
  built: 780,
  close: 750,
} as const;

export const TOTAL =
  Object.values(SCENE).reduce((a, b) => a + b, 0) -
  (Object.keys(SCENE).length - 1) * FADE;
