# Hub comfort — stop the window movement causing dizziness

_Written 2026-11-16. Status: **plan, not started.** Follows `hub-scene.md` (implemented)._

> **Update 2026-11-16:** the deck (option B) was tried and dropped. The hub is back on the ring
> layout, but the windows no longer slide: on each dial step the pictures and names fade out,
> the windows take their new slots unseen, and they fade back in (close to option C). See
> `stepDissolve` in `src/hub/ring.ts` and `layout()` in `src/systems/hub-system.ts`.

Turning the dial in the hub makes people dizzy. This plan replaces the orbiting ring with a
**deck**: the windows stand like a spread stack of cards straight ahead, and turning the dial
brings the next one forward with a short eased step.

## 1. Why it is dizzy today

| Cause | Where in the code |
|---|---|
| Five tall windows sweep sideways around you, from −72° to +72°. Big shapes moving across the edge of your view on a black background read as "I am rotating", while your body feels nothing. This is called vection, and it is the main cause of VR sickness. | `layout()` in `src/systems/hub-system.ts`, `ringXZ` / `windowAngleDeg` in `src/hub/ring.ts` |
| The ring is tied 1:1 to the hand. Every small hand shake or speed change moves the whole ring. | `update()`: `this.value -= wrapPi(...)` drives the windows directly |
| The snap after release starts at full speed and only slows at the end (`value += (snap - value) * delta * 10`). The start is a jolt. | `update()`, snap branch |
| The picture inside each window is magnified 2.4×, so it slides fast inside the arch while the window moves. | `uK` in `src/hub/window-material.ts` |

What the research and Meta's comfort guidance say (links at the end):

- Motion at the **edge** of the view drives vection. Motion in the centre mostly does not.
- **Smooth rotation of the surroundings** is the worst case. That is why games use snap turns.
- Things that **stay fixed** give the eyes a "rest frame" and reduce the conflict.
- Short, **discrete** changes are tolerated better than long continuous ones.

## 2. Options I looked at

| | Option | Motion you see | Verdict |
|---|---|---|---|
| A | Keep the ring, only add easing | Same ±72° sweep, smoother start | Smallest change, but the sideways sweep at the edge of view stays. Partial fix. |
| **B** | **Deck: windows stacked straight ahead, next one steps forward** | Small, in the centre of view, mostly toward you | **Recommended.** Keeps the "turn the dial, places come to you" feel. |
| C | Windows never move; only the pictures inside cross-fade | None | Most comfortable, but it stops feeling like a place you choose from. Kept as the fallback (step C5). |
| D | Keep the ring, but cut to black for 0.1 s on each step (like a snap turn) | None, but it blinks | Flashing on every detent is unpleasant in a calm app. Rejected. |

## 3. The deck (option B)

Top view, you at the bottom facing up. `0` is the front window, `±1` and `±2` stand behind it,
each half hidden by the one in front. The sixth window is invisible at the back.

```
              ( 3 )                 hidden, 4.5 m
      -2                +2          4.0 m
          -1        +1              3.5 m
               0                    3.0 m   <- glows, click to enter

              dial
              you
```

| Slot | x (m) | Distance (m) | Angle from straight ahead | Visible |
|---|---|---|---|---|
| 0 (front) | 0 | 3.0 | 0° | full, glowing |
| ±1 | ±0.62 | 3.5 | ±10° | dim |
| ±2 | ±1.05 | 4.0 | ±15° | dim |
| 3 (back) | — | 4.5 | — | faded out; this is where a window changes sides, unseen |

Compared with today:

| | Ring (today) | Deck |
|---|---|---|
| Width of the whole hub in your view | about ±80° | about ±21° |
| How far a window travels per dial step | 36° sideways | 10° sideways, 0.5 m toward you |
| Windows moving at the edge of view | yes | no |

All windows face you (no turning on their own axis). Places to the right on the dial stack to the
right, places to the left stack to the left, so direction still makes sense.

**Things that never move:** floor rings, title, dial stand. They are the rest frame.

**Label:** only the front window shows its name. It cross-fades when the front window changes.
Side labels would overlap in the stack.

## 4. Easing

Split the one number `value` into two:

| | Meaning | Follows |
|---|---|---|
| `value` | where the dial knob is | the hand, 1:1, as today |
| `view` | where the windows are | an eased chase toward the nearest whole detent |

- While you drag, the **knob** follows your hand. The **windows wait** until the knob passes the
  halfway point to the next place, then play one step. Hand shake no longer moves the windows.
- A small dead zone (flip at 0.6, flip back at 0.4) stops flicker when you hold the knob exactly halfway.
- `view` chases its target with a critically damped spring ("smooth damp"): it starts slowly,
  speeds up, and slows into place with no overshoot. One step takes about 0.45 s. If you spin
  fast through several places, the target simply moves on and the motion stays smooth, with no
  queue of animations.
- Glow, label and tick sound are driven by `view`, so light and motion stay together.
- Thumbstick, arrow keys, wheel and clicking a side window use the same chase.

## 5. Code changes

| File | Change |
|---|---|
| `src/hub/ring.ts` | Add `deckSlot(offset)` returning x, z, fade and glow for a continuous offset (−3…3), `smoothDamp(current, target, velocity, smoothTime, dt)`, and `stepTarget(value, currentTarget)` with the dead zone. Remove `ringXZ`, `windowAngleDeg`, `windowFade`, `STEP_DEG` once unused. Stays free of engine imports. |
| `src/hub/ring.test.ts` | Replace ring tests: front slot is at (0, −3) with glow 1; ±1 mirror each other; slot 3 has fade 0; `smoothDamp` reaches the target without overshoot; `stepTarget` dead zone. |
| `src/systems/hub-system.ts` | Add `view`, `viewVel`, `target`. `update()` moves `view` with `smoothDamp`; `layout()` uses `deckSlot(detentOffset(i, view))`; the knob still uses `value`. `onWindowClick` decides "front or side" from the offset instead of the angle. Label: front only. No allocation in `update()`. |
| `src/hub/window-material.ts` | Only if the picture still swims (step C4): lower `uK`, or measure the view direction from the window's centre so the picture rides with the card. |
| `docs/plan/hub-scene.md` | Note under D3 that the ring was replaced by the deck, with a link here. |

No scene JSON, model or UI file changes: window positions are already set by the system each frame.

## 6. Steps

| Step | Work | Done when |
|---|---|---|
| C1 | `ring.ts` deck maths + tests | `npm test` and `npm run typecheck` pass |
| C2 | `hub-system.ts`: `view` chase, deck layout, front-only label | typecheck passes; in the emulator **inside an XR session**, a screenshot matches the table in section 3 |
| C3 | Check the ease | log `view` once per frame over one step: slow start, no overshoot, settles in 0.4–0.5 s; a three-step spin shows no jump |
| C4 | Tune by eye: spacing, dim level of side windows, picture swim (`uK`) | side windows are readable but clearly behind; picture does not slide noticeably during a step |
| C5 | Fallback, only if C6 still reports dizziness: set the slot positions equal for all states (windows fixed) and cross-fade pictures instead | — |
| C6 | **Headset pass on a real Quest** | you turn the dial through all six places several times, sitting, without discomfort |
| C7 | Regression: desktop hub (drag, wheel, arrows), enter place, **Change place**; `npm run build` | all pass |

The emulator can prove the layout and the timing. It cannot prove comfort. Only C6 can.

## 7. Questions for you

1. Deck as drawn (two windows peeking out on each side), or a tighter stack with only one per side?
2. Front-only label OK, or do you want small names on the side windows too?
3. Should the windows wait for the half-way point while dragging (my plan), or follow the hand continuously but smoothed? The first is calmer; the second feels more direct.

## Sources

- [Meta: locomotion comfort and usability](https://developers.meta.com/horizon/design/locomotion-comfort-usability/)
- [Meta: locomotion best practices](https://developers.meta.com/horizon/design/locomotion-best-practices/)
- [Meta: Lessons from the Frontlines — modern VR design patterns](https://developers.meta.com/horizon/blog/lessons-from-the-frontlines-modern-vr-design-patterns/)
- [Peripheral Teleportation: a rest frame design to mitigate cybersickness (2025)](https://arxiv.org/abs/2502.15227)
- [Peripheral visualization of reverse optical flow for VR sickness reduction](https://www.mdpi.com/2079-9292/12/4/861)
