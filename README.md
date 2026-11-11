# Still Places

Sit somewhere beautiful and breathe. A meditation website that runs in a VR headset
(WebXR, built with Meta's [Immersive Web SDK](https://developers.meta.com/horizon/develop/iwsdk/))
or on any screen.

- **6 places**: 360° panoramas from [Poly Haven](https://polyhaven.com/hdris) (CC0), self-hosted.
- **4 practices**: breathing (with a pacing light), body scan, open sitting with interval bells, loving-kindness.
- **3 / 5 / 10 / 20 minutes**, each built from the same arrive → settle → anchor → main → close structure.
- **Sound**: singing bowls and rain / forest / waves / stream / night ambience, synthesized in the
  browser. They can optionally be swapped for CC0 recordings from Freesound.
- **English and 中文**, in the page and in the VR panels.
- No accounts and no backend. Preferences and history stay in `localStorage`.

The design, research and roadmap are in [`src/plan/`](src/plan/README.md).

## Run it

Requires Node 20.19+, 22.12+ or 24+.

```sh
npm install
npm run dev        # downloads the HDRIs on first run (~180 MB once, ~50 MB kept), then starts
                   # an HTTPS dev server with the IWER headset emulator
```

On a Quest, join the same Wi-Fi network, open the Network URL that the dev server prints, and accept
the certificate warning.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server + emulator (`dev:runtime` for plain Vite) |
| `npm test` | Session timeline/runner tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run build` | Fetch missing HDRIs, check credits, build to `dist/` |
| `npm run fetch:hdris` | Download + resize the panoramas listed in `src/data/places.json` |
| `npm run fetch:sounds` | Optional: `FREESOUND_TOKEN=… npm run fetch:sounds` pulls CC0 recordings listed in `assets/sounds.json` |
| `npm run build:font` | Rebuild the VR panel font subset after changing any text |
| `npm run check:credits` | Fail if any media file lacks a credits entry or uses a disallowed licence |

## How it fits together

```
src/
  index.ts              registers the systems below, mounts the 2D overlay
  app.ts                store, audio engine, cross-module actions
  state.ts / storage.ts app state, prefs + history in localStorage
  session/              pure session logic: timeline (cues) + runner (clock); unit-tested
  audio/                Web Audio engine: synthesized bowls & ambience, optional samples
  systems/
    place-system        Poly Haven background (DomeTexture) + lighting (IBLTexture), fades
    session-system      runs the clock, dispatches cues, pause/resume/end
    breath-orb-system   the breathing light
    vr-ui-system        UIKitML panels in VR (menu, caption, pause, summary)
    look-system         drag/arrow-key look on flat screens
    ground-system       mat + cushion under the viewer
  ui/                   2D overlay (HTML) and the VR font loader
public/ui/*.uikitml     VR panels          public/scenes/  IWSDK scene
scripts/                asset pipeline      about.html      credits page
```

## Adding a place

1. Pick an HDRI on polyhaven.com and add it to `src/data/places.json`, with `focusU` set to the
   horizontal position (0–1) of the view the user should face.
2. Add its name to `public/ui/menu.uikitml` (a `place-<id>` chip), then run `npm run fetch:hdris`
   and `npm run build:font`.
3. In dev, the `[` and `]` keys rotate the dome by 30° and log the yaw, which helps tune `focusU`.

## Licences

Code: yours to choose (no licence file yet). Panoramas: CC0 (Poly Haven). Font: Noto Sans SC subset,
SIL OFL 1.1. Guidance text is original to this project. See `public/credits.json` and `/about.html`.
