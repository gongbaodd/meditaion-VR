# Hand menu — plan

_Written 2026-11-16. Status: **implemented on branch `handmenu`** (M1–M4). Typecheck, 71 tests and `npm run build` pass. Verified in the IWER emulator inside an XR session: palm toward head opens the menu beside the hand, palm away closes it, ray-pinch on the steppers changes the length, **Begin** starts a session and the hand HUD replaces the menu, **Pause** opens the pause panel, and a raised controller opens the menu too. **Not done:** M5 (real Quest tuning), poke confirmation, and the 5 s fallback (the emulator never reports "nothing tracked")._

## What differs from the plan below

- **The hub has a hand menu too** (changed after the plan): `< place >` turns the ring one place per tap (same as the dial), **Enter** goes into the front place, plus language and **Exit VR**. Panel `public/ui/hand-hub.uikitml`, node `vr-hand-hub`. This replaces D3's "hub: no hand menu".
- **Pinky side is the inner side.** With the palm turned to your face the little finger points towards your nose, so the panel sits between the hand and the middle of your view. Left hand → panel to its right. Controllers follow the same side.
- **Fade is a scale pop** (0.6 → 1 over 0.15 s), not an opacity fade, to avoid per-frame UIKit property writes.
- **Own-hand guard is geometric**, not a click filter: the panel sits 8 cm clear of the palm edge, so the holding hand's fingers do not reach it (S2 not answered).
- **Spike S4 answered:** the emulator can pose a hand: `xr set-hand-pose` then `xr set-transform` with `anchor: "wrist"` and `orientation: {fingers, palm}` directions. Emulator eye height is 1.6 m, so raise the test hand to about 1.5 m or the look-at test (35°) correctly refuses.
- **S1 answered:** `jointTransforms` is filled in the emulator and the assumed joint order works.
- **S3 open:** an emulated fingertip move through a button did not click. Ray-pinch works. Check poke on a headset.
- `xr run-sequence` resets the other hand, which closes the menu mid-test; use `set-transform` + `look-at` + `select` instead.
- The VR font has no `‹ ›` glyphs, so the steppers use `<` `>`.


Today the VR menu is a big panel that floats 1.2 m in front of you (`VRUISystem.show()` →
`placeInFront()`), re-placed every time the mode changes. This plan moves it onto your hand while
you are in XR (an immersive headset session). The desktop 2D overlay does not change.

## 1. What a hand menu is

A hand menu is a small panel attached to one hand instead of to the world. You **turn your palm
toward your face** and the panel appears beside that hand. You press its buttons with the **other
hand**. You lower the hand and it goes away. Nothing floats in your view while you are not using it,
which suits a meditation app.

The pattern comes from HoloLens (MRTK "Hand Menu") and is also used in Meta Quest system UI. The
rules below are taken from the MRTK guidance:
<https://learn.microsoft.com/en-us/windows/mixed-reality/mrtk-unity/mrtk2/features/ux-building-blocks/hand-menu>

- Show it only when the palm faces you **and** you are looking at it, so it does not pop up by accident.
- Put it **beside** the hand (little-finger side), not on top of the palm. Two overlapping hands break hand tracking.
- Keep it small: a few large buttons, each at least 3.2 cm so a fingertip can hit it.
- Keep it stable: smooth the motion, and do not flicker at the edge of the show/hide angle.

## 2. What the user experiences

1. **In a place, choosing (mode `menu`).** No panel in front of you. A one-line hint floats low in
   front: "Look at your palm to open the menu". It goes away the first time the menu opens.
2. **Raise either hand, palm toward your face.** A hand-sized panel fades in next to that hand and
   follows it. It shows practice, length, sound and **Begin**, plus Change place / language / Exit VR.
3. **Press with the other hand.** Either poke a button with your index finger, or point and pinch.
4. **Lower the hand.** The panel fades out after a short delay.
5. **During a session (mode `running`).** Same gesture shows a tiny panel: time left and **Pause**.
   The guidance cue text stays in front of you as today.
6. **Paused / finished.** The pause and summary panels stay in front of you as today.
7. **Hub.** No hand menu; the dial is the control there.

## 3. Decisions I made (say if you want them different)

| # | Decision | Why |
|---|---|---|
| D1 | **Either hand** can hold the menu. The first palm that faces you wins until it is lowered. | No left/right-handed setting needed. |
| D2 | A **new compact panel**, not the current one shrunk. Each choice is one row you tap to step through: `‹ Breathing ›`. | The current menu has 18 buttons in 1100 px. Shrunk to hand size (about 22 cm) each chip would be 1.3 cm tall, too small to poke. A compact layout gives 5 rows of about 3.4 cm. |
| D3 | Hand menu replaces the **menu** and the **session HUD**. **Pause** and **summary** stay in front. | Pause and summary are answers to something you just did, so they should be visible without a gesture. |
| D4 | With **controllers** (no hand tracking) the panel attaches above the controller and shows when you raise it into view. The other controller's ray presses it. | Controllers have no palm. Raising it like a wristwatch is the closest equivalent. |
| D5 | During a session the palm must face you for **0.6 s** before the HUD shows; in the menu it is 0.15 s. | Meditation posture often rests the hands palm-up on the knees. The look-at check already excludes that, the delay is a second guard. |
| D6 | If no hand or controller is tracked for 5 s in mode `menu`, fall back to today's panel in front. | Otherwise there is no way to start. |
| D7 | Keep "any trigger pauses" (`session-system.ts:149`). | It is the fast way out. Hand pinch does not fire it today, and that stays so. |

## 4. When the menu shows

All tests run each frame per hand. Numbers are starting values to tune on a real headset.

| Test | Show when | Hide when |
|---|---|---|
| Palm faces head: angle between palm normal and the palm→head line | < 40° | > 55° |
| You look at it: angle between head forward and the head→palm line | < 35° | > 45° |
| Distance palm to head | 0.20 – 0.70 m | outside 0.15 – 0.80 m |
| Hand is tracked | yes | lost for more than 0.5 s (hold the last pose meanwhile) |

Different show and hide thresholds (hysteresis) stop flicker at the edge. Fade in 0.15 s, fade out
0.25 s. This logic is a pure function with no IWSDK imports, so it gets unit tests like `src/hub/ring.ts`.

## 5. Where the panel sits

- **Position:** palm centre, moved 11 cm toward the little-finger side and 3 cm toward your head.
  The side flips for the right hand.
- **Rotation:** faces your head, upright (billboard), not glued to the palm's own tilt. Easier to read.
- **Smoothing:** position and rotation ease toward the target each frame (about 12 Hz cut-off) so
  hand-tracking jitter does not shake the text.
- **Size:** menu panel about 22 cm wide × 20 cm tall. HUD about 12 cm × 4 cm.
- **Controllers:** 8 cm above the grip pose (the pose where the controller sits in your fist), same billboard.

## 6. How it is built

### Palm pose (hands)

`world.input.visualAdapters.hand.left/right` (`XRHandVisualAdapter`) fills `jointTransforms`, a
`Float32Array` of 25 joint matrices **relative to the grip space**, in WebXR joint order. So:

- world joint = `world.player.gripSpaces[hand].matrixWorld` × joint matrix
- palm centre ≈ middle-finger-metacarpal (joint 10)
- palm normal = cross(index-metacarpal (5) − wrist (0), pinky-metacarpal (20) − wrist (0)), sign flipped for the right hand
- little-finger direction = pinky-metacarpal − index-metacarpal

Computing the normal from joints avoids relying on the grip pose's orientation, which differs
between devices. `world.input.isPrimary('hand', side)` says whether that side is a hand or a controller.

### New and changed files

| File | Change |
|---|---|
| `src/hand/palm.ts` (new) | Pure math: palm frame from three joint positions; show/hide decision with hysteresis and dwell. |
| `src/hand/palm.test.ts` (new) | Tests: faces head, faces away, palm-up on knee, edge hysteresis, tracking loss, dwell. |
| `src/systems/hand-menu-system.ts` (new) | Reads palm/grip pose, runs `palm.ts`, picks the holding hand, places and fades `vr-hand-menu` / `vr-hand-hud`. No allocation in `update()`. |
| `public/ui/hand-menu.uikitml` (new) | Compact chooser: 3 stepper rows, Begin, small row with Change place / language / Exit VR. |
| `public/ui/hand-hud.uikitml` (new) | Time + Pause, sized for a fingertip. |
| `src/assets.ts` | Register the two panels. |
| `public/scenes/main.iwsdk.scene.json` | Add nodes `vr-hand-menu`, `vr-hand-hud` with `RayInteractable` **and** `PokeInteractable`. Keep `vr-menu` for the D6 fallback. Remove `vr-hud`. |
| `src/systems/vr-ui-system.ts` | Wire and relabel the new panels. In XR, stop showing `vr-menu` (except D6) and `vr-hud`; leave their placement to `HandMenuSystem`. Add the hint text via `vr-cue`. |
| `src/i18n/en.json`, `zh.json` | `ui.handHint`. |
| `src/index.ts` | Register `HandMenuSystem` after `VRUISystem`. |

`VRUISystem` keeps owning labels, clicks and selected state. `HandMenuSystem` only owns pose and
visibility. Panel authoring goes through the `iwsdk-ui` skill, scene JSON through `iwsdk-compose-scene`.

### Interaction

- **Poke:** `PokeInteractable` makes IWSDK's touch pointer press a UI element when the index
  fingertip comes within 2 cm of it. No custom code.
- **Ray + pinch / trigger:** already works through `RayInteractable`.
- **The holding hand must not press its own menu.** Its fingertip is within the 20 cm hover range
  and its ray may cross the panel. Clicks from the holding side are ignored in `VRUISystem.on()`.

## 7. Spikes before building

| # | Question | If no |
|---|---|---|
| S1 | Does `jointTransforms` hold valid data in the IWER emulator (IWSDK's browser XR emulator) hand mode and on Quest, and is joint 0/5/10/20 the order assumed above? | Read joints with `frame.getJointPose` in the system. |
| S2 | Does a UIKit `click` event tell which side's pointer fired it? | Suppress the holding hand's pointers while the menu is shown, or accept and rely on the panel offset. |
| S3 | Does poke on a UIKitML panel fire `click` reliably while the panel moves with the hand? | Freeze the panel pose while the other fingertip is within 6 cm. |
| S4 | Can the emulator CLI rotate a hand so the palm faces the head? | Verify gesture logic by unit tests and on a real Quest only. |

## 8. Steps

| Step | Work | Done when |
|---|---|---|
| M0 | `npm install` in this worktree (it has no `node_modules`). Run S1–S4. | Answers written into this file. |
| M1 | `palm.ts` + tests. | `npm test` passes. |
| M2 | `hand-hud` panel + `HandMenuSystem` for mode `running` only. | In an XR session the HUD follows a raised palm and Pause works by ray. |
| M3 | `hand-menu` panel, wiring, stepper rows, hint, remove in-front menu in XR. | Hub → place → palm menu → Begin works end to end. |
| M4 | Poke, own-hand click guard, controller mode (D4), fallback (D6). | Each checked in the emulator with `iwsdk-ray`. |
| M5 | Real Quest pass with `iwsdk-native-xr-test`: tune section 4 and 5 numbers, text size, comfort over a 5-minute session. | No accidental opens while sitting with hands on knees. |

Every step: `npm run typecheck`, `npm test`, then check in the runtime inside an XR session. A flat
screenshot outside XR cannot prove hand pose or interaction.

## 9. Risks

- **Accidental opens during a session.** Covered by the look-at test and D5. M5 checks it for real.
- **Hand tracking drops when hands overlap.** Covered by the side offset and the 0.5 s hold.
- **Discoverability.** A menu you cannot see needs the hint (section 2.1) and the fallback (D6).
- **Arm fatigue.** The chooser needs up to about 10 taps with one arm raised. If M5 shows this is
  tiring, add "pinch the holding hand to pin the menu in front of you".
- **Emulator limits.** Gesture feel and poke accuracy can only be judged on a headset.
