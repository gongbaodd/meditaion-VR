# Hub scene — plan

_Written 2026-11-16. Status: **implemented on branch `hub`** (H1–H7). Verified in the IWER emulator inside an XR session: hub → click front window → place + menu (no Place row) → **Change place** → hub. Typecheck, 58 tests and `npm run build` pass. Not yet tried on a real Quest: dial twist comfort, reach and text size. The dial is turned by a custom ray-on-plate drag (not IWSDK grab components), so `features.grabbing` stays `false`._

Replace the first thing you see in VR (today: a flat menu panel floating inside the last-used place)
with a dark "hub": a ring of arched windows, one per place, and a dial in front of you that turns
the ring. The window facing you glows in its place's colour. Click it to go inside.

Reference: `~/Downloads/hub.jpg` (VibeXR Worlds hub) for the layout and mood only: black space,
thin white outlines, faint floor rings. Names, logo and art are our own.

## 1. What the user experiences

1. **Enter VR → hub.** Black surroundings, faint concentric rings on the floor, "Still Places" title
   floating high in front. You sit on the existing mat and cushion.
2. **Windows.** Six arched windows stand on the floor on an arc around you, about 3 m away. Each
   shows a small view of its place inside the arch. The place name sits **under** each window.
3. **Dial.** A knob on a slim stand, in front of you at lap height, within arm's reach. Turning it
   turns the whole ring, like a carousel. It clicks into six detents, one per place, so a window
   always ends up exactly in front of you.
4. **Glow.** The front window lights up in its place's colour (outline, soft halo, a pool of light on
   the floor). The others stay dim white outlines. While the dial is moving, the glow cross-fades
   between neighbours.
5. **Go inside.** Click the front window (ray + trigger, or hand pinch). The hub fades out, the
   place's sky fades in, and the existing menu appears with practice / length / sound / Begin.
   Clicking a side window does not enter it; it turns the ring to bring that window to the front.
6. **Come back.** The in-place menu gets a **Change place** button that returns to the hub.

Everything after "inside the place" (session, pause, summary) stays as it is.

## 2. Decisions I made (say if you want them different)

| # | Decision | Why |
|---|---|---|
| D1 | Hub is **VR only**. Desktop keeps the 2D overlay with place thumbnails. | The overlay already covers place choice on a flat screen, and a dial is awkward with a mouse. |
| D2 | After entering a place you land in the **existing menu, minus the Place row**, not straight in a session. | You still have to pick practice and length somewhere. |
| D3 | Ring is a **wrapping carousel**, 36° between windows, not a full 360° circle. | Six windows on a full circle would be 60° apart, so you would only ever see three. At 36° you see five, like the picture. Windows fade out past ±90° and come back on the other side. |
| D4 | Window interior shows the place's existing **640×320 thumbnail**, sampled by view direction so it shifts as you move your head, like looking through a real window. | No new downloads; loading six 4k images up front would cost about 200 MB of GPU memory. |
| D5 | One accent **colour per place**, hand-picked, stored in `places.json`. | "Glow the colour of the place" needs a defined colour. Proposal below. |
| D6 | The hub is **silent** apart from a soft tick per detent. Place ambience starts when you go inside. | Simple. A quiet preview of the front place's ambience is an easy later add. |

Proposed colours (D5):

| Place | Colour | |
|---|---|---|
| Mountain Dawn | `#ff9d6c` | warm peach |
| Forest Light | `#7fd08a` | leaf green |
| Lakeside | `#6fc3d9` | water teal |
| Sunrise Shore | `#ffc46b` | gold |
| Alpine Meadow | `#b9e36b` | spring green |
| Starry Night | `#7d8cff` | indigo |

## 3. Layout (metres; player at origin, seated eye height 1.2, facing −Z)

| Thing | Placement |
|---|---|
| Window ring | radius 3.0, windows 0.9 wide × 1.7 tall, standing on the floor, each facing the centre |
| Window spacing | 36°; front window at 0°, visible ones at ±36° and ±72° |
| Place label | small panel centred under the arch, about 0.35 above the floor, tilted up to face you |
| Title | 3.2 away, 2.3 high |
| Dial | 0.45 in front, 0.80 high, knob 12 cm across, tilted 35° toward you, on a thin stand |
| Floor rings | flat line circles at radius 1.5 … 6, fading with distance |

The dial angle maps 1:1 to detents of 60° (one full turn of the knob = all six places), and each
detent moves the ring by 36°.

## 4. How the dial is turned

Three inputs, same result:

- **Hand or controller, near:** grab the knob (pinch or squeeze) and twist your wrist.
  Uses IWSDK's `OneHandGrabbable` with translation off and rotation limited to the knob's axis.
- **Ray, far:** point at the knob, hold trigger, twist. Uses `DistanceGrabbable` in `RotateAtSource` mode.
- **Fallback:** thumbstick left / right steps one detent; clicking a side window steps to it.

On release the knob eases to the nearest detent. Each detent crossed gives a haptic pulse and a tick sound.

This needs `features.grabbing: true` in `iwsdk.config.json` (currently `false`).

**Spike before building (S1):** confirm the grab rotation constraint lets the knob turn past ±180°
continuously. If it clamps, the fallback is a custom twist: while the knob is `Pressed`, read the
roll of the hand/controller around the knob axis each frame and add the difference to the dial.

## 5. Code changes

**State**

- `src/state.ts`: add `'hub'` to `Mode`; add `color` to `Place`.
- `src/data/places.json`: add `color` per place.
- `src/components.ts`: two components, `Dial { value, detents }` and `PlaceWindow { index }`.
- Mode rules: entering VR while in `menu` → `hub`. Leaving VR while in `hub` → `menu`.
  Window click → `setPrefs({ place, ambient })` then `mode: 'menu'`. **Change place** → `hub`.

**New models** (`src/scene-assets/`, built with the `iwsdk-build-model` skill, registered in `src/assets.ts`)

- `place-window`: arch outline tube, inner pane, halo quad, floor glow disc. Unlit materials so it
  reads on black without bloom.
- `hub-dial`: stand, knob with grip ridges, pointer notch, six tick marks.
- `hub-floor`: concentric line rings.

**New UI** (`public/ui/`, built with the `iwsdk-ui` skill)

- `hub-title.uikitml`: title + one hint line ("Turn the dial. Select a window to enter.").
- `window-label.uikitml`: one name chip, used six times.

**Scene** (`public/scenes/main.iwsdk.scene.json`, edited with the `iwsdk-compose-scene` skill)

- Add a `hub` parent node holding floor, dial, title, six windows and six labels.
  Windows and dial carry `RayInteractable`; the dial also carries the grab components.

**Systems**

- New `src/hub/ring.ts`: pure maths (wrap angle, nearest detent, window angle and fade for a dial value). Unit-tested with vitest.
- New `src/systems/hub-system.ts`: reads the dial, positions and fades the windows, drives the glow,
  snaps on release, handles window clicks and thumbstick steps, shows/hides the hub by mode, fills labels from `src/strings.json`.
- `src/systems/place-system.ts`: in `hub` mode keep the dome at zero and the lighting low; fade the place in on entry (reuses the existing fade).
- `src/systems/vr-ui-system.ts` + `public/ui/menu.uikitml`: remove the Place row, add **Change place**; show no menu in `hub`.
- `src/audio/`: a short synthesized tick for detents.
- `src/strings.json`: `ui.changePlace`, `hub.hint`.
- `src/index.ts`: register `HubSystem`.

**Untouched:** session runner and timeline, breathing orb, pause / summary / HUD panels, 2D overlay, storage, audio beds.

## 6. Steps

| Step | Work | Done when |
|---|---|---|
| H0 | Spike S1 (dial rotation via grab components) | know which of the two dial implementations to use |
| H1 | State + `ring.ts` + tests; `color` in places | `npm test` and `npm run typecheck` pass |
| H2 | Three models, registered | each looks right in an isolated render |
| H3 | Scene composition + title and label panels | editor render matches the layout table; origin is clear |
| H4 | `HubSystem`: ring turns, snaps, glows; dial works by grab, ray and thumbstick | verified in the emulator **inside an XR session**, by state query and one screenshot |
| H5 | Enter / leave: window click, place fade-in, menu without Place row, **Change place** | full loop hub → place → session → summary → menu → hub works in the emulator |
| H6 | Regression: desktop overlay flow unchanged; `npm run build` passes | |
| H7 | Update `src/plan/README.md` status | |

Not covered by emulator testing: wrist-twist comfort, dial reach and text size on a real Quest.
Those need a headset pass.

## 7. Questions for you

1. **D1**: hub in VR only, or do you also want it on desktop (drag the dial with the mouse)?
2. **D2**: after clicking a window, land in the practice/length menu (my plan), or start a session immediately with the last-used settings?
3. **D5**: are the six colours OK, or should the colour be sampled from each photo automatically?
4. Labels **under** the windows as you wrote (the reference picture has them above). Confirm under.
5. Should the hub remember the last place and start with that window in front? (I plan yes.)
