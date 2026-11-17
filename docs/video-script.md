# Still Places — 3-minute intro video script (draft for review)

**Length:** 3:00 · **Format:** 1920×1080, 30 fps (5,400 frames) · **Tool:** Remotion
**Tone:** slow, warm and quiet. Long holds, soft cross-fades and no fast cuts. The video should feel like the app.
**Voice:** on-screen text only (no narration), over a soft synthesized pad with singing bowls at the section changes.
Optional: add a voice-over later using the same lines.

## Source footage

| Tag | File (`docs/records/`) | Length | What's in it |
|---|---|---|---|
| **A** | `AQM2cN9y…mp4` | 7:38 | Sunrise Shore session: hand menu, breathing orb, cues, "Session complete", Alpine Meadow, hub and dial |
| **B** | `AQOORkKW…mp4` | 3:20 | Hub → Mountain Dawn session, Forest Light, hub, dial on the beach, setup panel |
| **S1, S2** | the two `.jpg` stills | 2160² | headset captures (for a thumbnail or end card) |
| **P** | `docs/screenshots/1-5.png` | — | backup stills |

The recordings are square (1024²), so they sit in a centred rounded "headset view" frame on a dark,
slowly drifting gradient background in the place's colour (from `places.json`). Exception: the slow
full-bleed sections in scenes 1, 4 and 9, where the footage is cropped to 16:9.
Timestamps below are approximate, and I'll fine-tune them when cutting.

---

## Scene 1 — Cold open (0:00–0:15)
- **Visual:** black, then Sunrise Shore fades in full-bleed (A ≈ 1:00–1:15). The sun is on the horizon and the orb is breathing.
- **Text (centred, fades in and out):** *"In the middle of a dark winter, I caught a bad cold."* → *"I couldn't travel. But I had a headset."*
- **Sound:** waves come up from silence.

## Scene 2 — Title (0:15–0:25)
- **Visual:** slow push-in on the beach; the title is set in Noto Sans SC.
- **Text:** **Still Places** / *Sit somewhere beautiful and breathe.*
- **Sound:** first singing bowl.

## Scene 3 — What it is (0:25–0:45)
- **Visual:** three-up grid of short loops: Mountain Dawn (B ≈ 0:40), Forest Light (B ≈ 2:00), Alpine Meadow (A ≈ 5:40).
- **Text:** *A meditation website that runs in a VR headset — or in any browser tab.*
  Below it, three small chips: **WebXR** · **No install** · **No account**

## Scene 4 — The hub (0:45–1:10)
- **Visual:** framed footage of the hub, a ring of arched windows (A ≈ 6:20–6:50, B ≈ 0:00–0:15). The hand turns the dial, windows fade out and back in, and one is entered.
- **Text, in sequence:**
  1. *Six places, each a full 360° panorama.*
  2. *Turn the dial to browse. Step through a window to enter.*
  3. *Nothing slides past you. Windows fade and swap, so the hub stays comfortable.*
- **Graphic:** six small coloured dots labelled Mountain Dawn · Forest Light · Lakeside · Sunrise Shore · Alpine Meadow · Starry Night, lighting up one by one.

## Scene 5 — Set up a session (1:10–1:25)
- **Visual:** setup panel on the beach (B ≈ 3:00–3:15). Length 3/5/10/20 min and sound Rain/Forest/Waves/Stream/Night/Silence, then Begin.
- **Text:** *3, 5, 10 or 20 minutes. Rain, forest, waves, stream or night.*
- **Callout:** highlight rings pulse on the chips as they are tapped.

## Scene 6 — Breathe (1:25–1:55) — the heart of the video
- **Visual:** long, mostly uncut hold on the breathing orb (A ≈ 1:40–2:40). Cue captions are visible in the footage ("In for four, hold for seven, out for eight.").
- **Overlay:** a thin progress arc in the corner showing *arrive → settle → anchor → main → close*, advancing slowly.
- **Text (once, then off-screen to let it breathe):** *A glowing light paces each breath, so you can follow it with your eyes half-closed.*
- **Sound:** waves only, with a soft bowl at the end.

## Scene 7 — Hand menu (1:55–2:10)
- **Visual:** palm turned toward the face, the hand menu appears, then Pause (A ≈ 0:00–0:25; B ≈ 0:20 shows the hand and pause).
- **Text:** *Turn your palm toward you for a menu. Pause, change length or start a session. No controllers needed.*

## Scene 8 — How it's built (2:10–2:35)
- **Visual:** dark background with clean animated cards appearing one at a time (no footage, or footage dimmed behind):
  - **Meta Immersive Web SDK**: TypeScript, Vite and an ECS architecture
  - **Poly Haven CC0 HDRIs** → compressed cube maps
  - **UIKitML** spatial panels plus an HTML overlay for flat screens
  - **Web Audio**: every bell and ambience is synthesized, with no audio files
- **Mini-graphic:** "8K panorama: **680 MiB → compressed cube map**". The bar shrinks, with the caption *Measure before you guess.*

## Scene 9 — Close (2:35–3:00)
- **Visual:** "Session complete" card (A ≈ 5:20), then a cross-fade to the Mountain Dawn sky (B ≈ 1:20) going full-bleed, then a slow fade toward the stills.
- **Text:**
  1. *In VR, what feels calm matters more than what looks impressive.*
  2. End card: **Still Places**, the deployed URL, *Runs in any browser · Best in a Quest headset*
  3. Small credits line: *Panoramas: Poly Haven (CC0) · Built with IWSDK*
- **Sound:** final bowl, rings out to silence.

---

## Remotion project (built)
See [`video/README.md`](../video/README.md). Changes from the draft above:
- **Scene 5:** the setup panel is only on screen for about 10 s in recording B, so that clip plays at 0.68× speed. The chip highlight rings were dropped, because the panel moves with the head.
- **Scene 8:** the memory graphic uses the measured numbers from `docs/plan/performance.md`: **5,221 MiB → 93 MiB** of GPU texture memory after 18 place changes.
- **Scene 9:** the "Session complete" card comes from recording B (Mountain Dawn, ≈1:39).
- **Sound:** the app's own waves and singing bowls from recording A. There is no voice-over and no outside music.
- **End card:** shows `still-places.growgen.xyz` (`SITE_URL` in `video/src/theme.ts`) next to the heart-shaped QR code from `video/public/qr.svg`.
