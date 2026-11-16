# VR Meditation — Plan

_Written 2026-11-11. Research behind every decision is in [research.md](./research.md)._

## Status (2026-11-11)

M0–M4 are implemented, and M5 is implemented except for the deploy itself. The app is called **Still Places**.
Verified in the IWSDK managed browser and the IWER Quest 3 emulator. **Not yet tried on a real headset.**

| Milestone | State |
|---|---|
| M0 Scaffold | ✅ IWSDK **1.1.0-rc.2** (npm `latest`; the 0.5.3 docs are older), starter content removed |
| M1 Place | ✅ 6 Poly Haven places, fetch script, dome + IBL, fade-through-dark swaps, ground mat + cushion |
| M2 Sound | ✅ Web Audio engine, synthesized bowls + 5 ambiences; optional Freesound CC0 pipeline; credits check |
| M3 Session | ✅ data-driven timeline + runner (52 unit tests), breathing orb, pause / resume / end, history |
| M4 Menu | ✅ 2D overlay and VR UIKitML panels; prefs persist |
| M6 Hub | ✅ VR hub: ring of place windows + dial, **Change place** in the menu (see `docs/plan/hub-scene.md`). Emulator-verified only |
| M5 Ship | ◐ desktop fallback, EN + 中文 (VR too), credits page, GitHub Pages workflow. Not deployed: no remote yet |

**Spike answers**

- **S1 (LDR dome):** yes. `DomeTexture` accepts JPG, so backgrounds are 4k JPGs (1–3 MB), resized from
  Poly Haven's tonemapped JPGs, with an 8k upgrade loaded lazily in the headset. The 1k HDR is used only for IBL.
  Loaded JPGs need `colorSpace = SRGB` set by hand.
- **S2 (audio):** IWSDK has `AudioSource` / `AudioUtils`, but sessions need scheduled bells, cross-fades and
  master fades, so the app uses its own Web Audio engine.
- **S3 (swap):** set `src`, then `_needsUpdate`. Props only apply on `_needsUpdate`, so fades also write
  `scene.backgroundIntensity` / `environmentIntensity` directly. The dome yaw convention was calibrated with a
  labelled test panorama: forward u = 0.5 − yaw/2π.
- **S4 (scaffold):** `npm create @iwsdk@latest` has non-interactive flags; scaffolded into a temp folder, then rsynced in.

**Deviations from the plan**

- **Sound is synthesized by default.** Freesound originals need OAuth and a hand-curated pick.
  `npm run fetch:sounds` with a `FREESOUND_TOKEN` swaps in CC0 recordings (HQ previews), loop seams cross-faded.
- **VR text uses a custom font path.** UIKitML's `@font-face` builds an ASCII-only MSDF atlas, so the app
  generates the atlas with the full charset from a Noto Sans SC subset (`src/ui/vr-font.ts`, `scripts/build-font.mjs`).
- **Body scan has no body silhouette;** text cues only. Breath-pattern choice and interval bells are in the 2D menu only.

**Next**

- Test on a Quest (comfort, text size, 8k memory, hand-pinch pause).
- Pick and pin real CC0 sounds.
- Add a remote and deploy.
- Voice guidance (v2).

A website where you put on a headset (or just open a browser tab), pick a place and a
practice, and sit through a meditation session inside a Poly Haven HDRI, with bells,
ambient sound and a visual breathing guide.

## 1. Product in one page

**Flow:** landing page → choose *place* → choose *practice* + *length* → Enter VR →
session runs by itself → closing bell → short summary → back to menu.

| Choice | v1 options |
|---|---|
| Place | 6 curated HDRIs: dawn mountain, forest, lake, beach sunrise, meadow, starry night |
| Practice | Breathing, Body scan, Open sitting (bells only), Loving-kindness |
| Length | 3 / 5 / 10 / 20 min |
| Sound | Ambient bed (rain, forest, waves, night, silence) + bell set, each with own volume |
| Guidance | Visual (breathing orb + short text cues) in v1; voice in v2 |

**Principles**

- Seated, stationary, no locomotion, nothing moves the camera. Comfort beats spectacle.
- UI disappears during the session; one gesture/button brings back pause / end.
- Works without a headset (desktop/mobile 3D with drag-to-look) — same code, `Desktop 3D` fallback.
- Every bundled asset is CC0 or CC BY, recorded in a machine-readable credits manifest.
- No accounts, no backend. Preferences and session history in `localStorage`.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **IWSDK 0.5.x** (`@iwsdk/core`), TypeScript, Vite | Scaffold with `npm create @iwsdk@latest` → *Virtual reality* → *Customize*: TS, no locomotion/grabbing/physics. Node 24 is installed (needs 20.19+/22.12+/24+). |
| Environment | `DomeTexture` (visible) + `IBLTexture` (lighting) on the level root | They are independent components; both needed. |
| UI | UIKitML panels (`public/ui/*.uikitml`, `spatialUI: { kit: "horizon" }`) + plain HTML landing page | Ray-interactable panels for controllers and hands. |
| Audio | Web Audio API directly (own `AudioEngine`), IWSDK `AssetType.Audio` for buffer loading if it fits | IWSDK audio API was not documented in the pages read → spike S2. |
| Dev/test | `npm run dev` (HTTPS, IWER emulator set to `metaQuest3`), Quest browser over LAN | |
| Hosting | Static (GitHub Pages / Cloudflare Pages) | HTTPS is required for WebXR. |

## 3. Assets

### 3.1 HDRIs (Poly Haven, CC0)

**Self-host, do not hot-link.** A script downloads the chosen files at build/setup time;
the live API then isn't a runtime dependency and no "Powered by Poly Haven" credit is
required (we credit them anyway).

`scripts/fetch-hdris.mjs`:
1. reads `assets/hdris.json` (list of asset ids),
2. calls `https://api.polyhaven.com/files/{id}` with a unique `User-Agent`,
3. downloads into `public/hdri/` and verifies `md5`,
4. appends to `public/credits.json`.

**Size budget is the main constraint** (measured on one asset):

| Resolution | `.hdr` size | Use |
|---|---|---|
| 1k | ~1.4 MB | IBL lighting — plenty |
| 2k | ~5 MB | background on desktop / low-end |
| 4k | ~20 MB | background in headset, minimum that looks sharp |
| 8k | ~73 MB | too heavy to ship as HDR |

→ Per place: **1k HDR for IBL** + a **separate background**: 2k HDR first, upgraded lazily
to 4k (`priority: 'lazy'`). Spike S1 checks whether `DomeTexture` accepts an LDR texture
(Poly Haven's 8k tonemapped JPG, or KTX2) — if yes, that replaces the 20 MB HDR.

Candidate ids (all verified to exist in the API, final pick after viewing in headset):
`kiara_1_dawn` (mountain dawn), `alps_field` (meadow/forest/mountain), `resting_place` (lake),
`umhlanga_sunrise` / `spiaggia_di_mondello` (beach), `lilienstein` (forest meadow),
`je_gray_02` (forest), `dikhololo_night` / `rogland_clear_night` (stars),
`kloofendal_48d_partly_cloudy_puresky` (sky only — good neutral default).

Caveat: an HDRI is a photo sphere, not 3D — no parallax. Fine when seated; add a small
real ground disc/mat under the user so the feet area isn't a smeared tripod patch.

### 3.2 Sound

Licence rule for anything committed to the repo: **CC0 or CC BY only.** No NC, no ND,
no Pixabay raw files (their licence bans standalone redistribution).

| Need | Source | How |
|---|---|---|
| Singing bowls, bells, chimes | Freesound, `filter=license:"Creative Commons 0"` | Search by API token; download originals while logged in (original download needs OAuth2); never hot-link. |
| Rain, forest, waves, night, stream beds | Freesound CC0 | Trim to seamless 60–120 s loops, encode Opus/AAC ~96 kbps. |
| Optional drone/music pad | incompetech (credit required) or FMA tracks that are CC BY / CC0 | Check the licence on each track page. |
| Extra field recordings | Internet Archive, filter by `licenseurl` | Per-item licence; verify each. |

Each file gets an entry in `public/credits.json`
(`{file, title, author, source_url, license, license_url, changes}`) and the app renders a
Credits panel from it. A CI check fails if an audio/HDRI file has no entry.

### 3.3 Guided voice (v2)

None of the researched guided audio can be bundled and mixed: UCLA, Audio Dharma and
Dharma Seed are CC BY-NC-ND 4.0, Free Mindfulness is CC BY-NC-SA 3.0, Palouse is all
rights reserved, Medito content is a custom non-open licence. So:

- **v1:** no voice. Bells + visual cues + short text prompts we write ourselves.
- **v2:** our own scripts (structure informed by the research, wording original), recorded
  by a person or generated with TTS, per language (EN, 中文 first).
- A "Learn more" page links out to those free resources instead of embedding them.

## 4. Session design

Synthesised from track lengths and formats of the researched sources (the phase split is
our own design, not something those sites publish).

**Phases** (every practice uses the same skeleton):

| Phase | What happens in VR | 3 min | 5 min | 10 min | 20 min |
|---|---|---|---|---|---|
| Arrive | Fade in from black, 3 bells, "sit comfortably" cue | 0:15 | 0:25 | 0:40 | 1:00 |
| Settle | Orb leads slow breaths (4 s in / 6 s out) | 0:15 | 0:30 | 1:00 | 1:30 |
| Anchor | Cue names the anchor (breath / body / sound), orb dims | 0:20 | 0:45 | 1:00 | 2:00 |
| Main | Practice-specific; long stretches of nothing | 1:50 | 2:50 | 6:20 | 14:00 |
| Close | 1 bell, widen attention cue, fade up light, 3 bells | 0:20 | 0:30 | 1:00 | 1:30 |

**Practices**

- **Breathing** — orb pacing through Main; patterns: natural-follow, 4-6, box 4-4-4-4, 4-7-8.
- **Body scan** — text/voice cue per region, timed evenly across Main; a soft light travels a simple body silhouette.
- **Open sitting** — nothing but interval bells (every 5 min, like the Free Mindfulness bell tracks). Also the "timer" mode with custom length.
- **Loving-kindness** — four phrases × four recipients (self, friend, neutral, all), one bell between recipients.

**Data model** — sessions are data, not code:

```ts
type Cue =
  | { at: number; kind: 'bell'; sound: string; count?: number }
  | { at: number; kind: 'text'; key: string; hold: number }   // i18n key
  | { at: number; kind: 'voice'; clip: string }               // v2
  | { at: number; kind: 'breath'; pattern: [number, number, number, number] | null }
  | { at: number; kind: 'light'; intensity: number; fade: number };

interface SessionDef {
  id: string; practice: 'breath' | 'bodyscan' | 'open' | 'metta';
  minutes: 3 | 5 | 10 | 20;
  cues: Cue[];            // `at` in seconds, or fraction of a phase, resolved at start
}
```

`public/sessions/*.json` → loaded by `SessionSystem`, which runs a clock and dispatches cues.

## 5. Architecture

```
index.html                  landing page (2D), Enter VR button
iwsdk.config.json           xr.mode "vr", features: spatialUI only
public/
  hdri/  audio/  sessions/  ui/*.uikitml  credits.json
scripts/fetch-hdris.mjs     Poly Haven downloader
src/
  index.ts                  World.create(container, projectOptions) + register systems
  assets.ts                 defineAssets: HDRTexture (critical: default place 1k+2k; lazy: rest), Audio, UIKitML
  state.ts                  app state machine: menu → preparing → running ⇄ paused → summary
  systems/
    EnvironmentSystem.ts    swaps DomeTexture/IBLTexture, cross-fade via dome intensity
    SessionSystem.ts        clock, cue dispatch, pause/resume/end
    BreathGuideSystem.ts    orb scale/emissive driven by breath pattern
    AudioEngine.ts          ambient loop (cross-faded), bell one-shots, master/duck/fade
    MenuSystem.ts           UIKitML panels: place, practice, length, sound, credits
    ComfortSystem.ts        recenter, seated height, wrist/gaze "pause" affordance
  i18n/{en,zh}.json
  plan/                     this folder
```

State machine is the spine: systems only react to state + cues, so a session is fully
testable without a headset by driving the clock.

## 6. Milestones

| # | Goal | Done when |
|---|---|---|
| **M0** Scaffold | IWSDK VR starter merged into this repo, starter robot removed, CI typecheck/build | `npm run dev` shows empty scene in IWER and on Quest |
| **M1** Place | `fetch-hdris` script, one HDRI as dome + IBL, ground disc, spikes S1–S3 answered | Standing inside the HDRI in headset at 72+ fps, load < 5 s on Wi-Fi |
| **M2** Sound | AudioEngine, one ambient loop, bell set, credits manifest + check | Loop is seamless, audio starts on the Enter-VR gesture |
| **M3** Session | SessionDef + SessionSystem, breathing orb, 5-min Breathing end-to-end | A full session runs unattended incl. pause/end and fades |
| **M4** Menu | UIKitML menus, 6 places with lazy load + cross-fade, 4 practices × 4 lengths, settings persist | Whole flow usable with controllers and hands |
| **M5** Ship | Desktop/mobile fallback, EN + 中文, credits/learn-more pages, deploy | Public URL works in Quest browser |
| **v2** | Own voice guidance, streaks/history, sleep mode (dimming night scene), passthrough "eyes-open" mode, PWA offline | — |

**Spikes to run inside M1/M2 (unknowns from research)**

- **S1** Can `DomeTexture` take an LDR equirect (JPG/KTX2) instead of HDR? Decides download size.
- **S2** Does IWSDK expose an audio component worth using, or go straight to Web Audio? (`AssetType.Audio` exists; the rest wasn't in the docs read.)
- **S3** Runtime environment swap: replace component values on `world.activeLevel.value` vs. remove/add; is a cross-fade possible or do we fade through black?
- **S4** Merging the generator output into a non-empty directory (scaffold in a temp folder, move in, keep `src/plan`).

## 7. Risks

| Risk | Mitigation |
|---|---|
| HDRI weight (20 MB per 4k place) | 1k IBL + progressive background, lazy per place, S1 for LDR/KTX2 |
| IWSDK is pre-1.0 (0.5.3) and its docs contradict each other on defaults | Pin exact version; keep app logic (state, session, audio) independent of IWSDK APIs |
| Licence drift in audio | CC0/CC BY only, credits manifest enforced in CI |
| Autoplay policy | Create/resume `AudioContext` inside the Enter-VR click |
| Tripod/nadir artefacts and no parallax in HDRIs | Ground disc, seated-only, pick HDRIs with clean nadir |
| Health framing | Call it relaxation/mindfulness, no medical claims; short "not a medical treatment" note |

## 8. Open questions for you

1. Non-commercial hobby project, or could it become commercial? (Decides whether NC-licensed material may ever be linked/streamed.)
2. Voice guidance languages for v2 — EN + 中文?
3. Target device: Quest 3 browser first? Any need for Vision Pro / Pico?
4. Hosting preference (GitHub Pages is the default assumption).
