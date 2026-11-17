# Performance plan: stop the crashes when loading places

Status: **implemented 2026-11-11** (phases 0–5). Measured on desktop Chrome with the IWER emulator;
not yet on a real Quest. Results and deviations are in [Outcome](#outcome) at the end.

## The problem

The page is slow and often crashes, mostly while it loads a place (the 360° background). The
crash hasn't been reproduced and measured yet (step 0 does that). Reading the code, though, shows
GPU memory growing every time a place is shown, and none of it is ever freed. That fits "crashes
while loading": the tab dies when the browser runs out of GPU memory.

## Why it happens

### 1. Each background becomes a large cube map, and none are freed (main cause)

`PlaceSystem` hands a 4096×2048 JPG to IWSDK's `DomeTexture`. The `EnvironmentSystem` sets it
as `scene.background` with equirectangular mapping. At render time, three.js (r185,
`WebGLCubeMaps.getCube`) then converts it into a `WebGLCubeRenderTarget` whose faces are
**`image.height` pixels square**, with mipmaps, uncompressed RGBA8. That cube map is freed only
when the source texture's `dispose()` is called. We never call it, and `AssetManager` keeps every
texture in its cache anyway.

Approximate GPU memory (RGBA8, ×4/3 for mipmaps):

| What | Source texture | Cube map built from it | Total |
|---|---|---|---|
| 4k JPG (4096×2048) | 43 MiB | 6 × 2048² → 128 MiB | **≈ 171 MiB per place** |
| 8k JPG (8192×4096) | 171 MiB | 6 × 4096² → 512 MiB | **≈ 683 MiB per place** |

- On a flat screen, browsing all six places keeps about **1 GiB** of textures alive.
- In the headset, `maybeUpgrade()` also loads the 8k version and keeps the 4k one, so each place
  costs about **850 MiB**. Two or three places in VR are enough to go past what a Quest browser
  tab can hold.
- Phones crash sooner, because their tab memory limits are lower.

### 2. Long main-thread stalls while loading

- **JPEG decode.** `AssetManager.loadTexture` uses three's `TextureLoader`, which loads into an
  `<img>`. The browser decodes the JPEG on the main thread when it is uploaded to the GPU. That
  is 8 Mpx for 4k and 33 Mpx for 8k.
- **Cube conversion.** The equirect→cube render, plus mipmap generation, runs in the same frame.
- **IBL.** Each place's 1k `.hdr` is parsed on the main thread (RGBE→float), and a fresh PMREM
  is built from it.
- **VR font.** `vr-font.ts` generates MSDF atlases at runtime: about 400 glyphs × 2 weights
  into 2048×1024 atlases, on the main thread. This happens at startup even when the user never
  enters VR.

In VR, a stall of a few hundred milliseconds causes visible judder. A stall of seconds can make
the Quest browser show "page not responding" or end the XR session.

### 3. No limit on overlapping loads

Clicking through place cards quickly starts a full load for each one. The `token` check discards
stale results, but the textures still download, decode and stay in the cache.

### Lesser items (to confirm by measuring)

- **Audio.** Noise and impulse-response buffers are generated in JS when audio unlocks: 8 s
  stereo per noise colour, plus a 3.5 s reverb. This costs tens of milliseconds, which is fine
  but worth a look.
- **Never released.** The HDR source textures (`*_ibl.hdr`) stay cached after PMREM no longer
  needs them.

## Targets

These targets are the acceptance criteria for this work.

| Measure | Target |
|---|---|
| GPU texture memory for backgrounds | ≤ 64 MiB, **flat**, no matter how many places are visited |
| Place switch in VR (Quest 3) | No frame over 50 ms; no dropped XR session |
| Place switch on desktop | No frame over 100 ms |
| Soak test | 30 place switches in emulated XR, then 3 on a Quest. No crash, and `renderer.info.memory.textures` back to its baseline |
| First load (on a phone, 4G) | Menu usable in under 3 s; first place visible in under 6 s |
| Visual quality in VR | No worse than today's 4k (about 23 px/degree, which matches the Quest 3 display) |

## Plan

Each phase ships on its own and is checked against the targets above before the next one starts.

### Phase 0: Reproduce and measure (½ day)

1. Add a dev-only perf probe (`src/systems/perf-probe.ts`, only in `import.meta.env.DEV`) that
   logs:
   - `renderer.info.memory` (textures and geometries);
   - an estimate of texture bytes, adding up the size × format of live textures;
   - the longest frame in each place switch, measured with `performance.now()` deltas in
     `update()`.
2. Write a soak script (`scripts/soak.mjs`) that uses the IWSDK CLI. It enters emulated XR,
   cycles through all six places three times, and records the probe's logs.
3. On a Quest, connect Chrome DevTools remotely (`chrome://inspect` over USB). Record one
   Performance trace of a place switch, plus a memory reading before and after.
4. Write the baseline numbers into this file. If the measurements show something different from
   the analysis above, update the plan before going on.

### Phase 1: Stop the leak (small change, biggest effect; ½–1 day)

In `src/systems/place-system.ts`:

1. **Remove the 8k upgrade.** Delete `maybeUpgrade()`, the `hd` pref
   (`state.ts`/`storage.ts`/overlay) and the 8k output of `fetch-hdris.mjs`. Phase 2 restores
   the sharpness that 8k was meant to add, at a fraction of the cost.
2. **Free the previous place after the swap.** Once the new texture is applied (inside the dark
   part of the fade):
   - call `oldTexture.dispose()`, which also frees three's cached cube map;
   - call `CacheManager.deleteAsset(oldUrl)` so `AssetManager` drops its reference.

   Do the same for the old `.hdr` source. The PMREM target is already disposed by
   `EnvironmentSystem.setEnvironment`.
3. **One load at a time.**
   - Debounce place changes by 250 ms.
   - While a load is in flight, remember only the latest request and run it next.
   - If a result is no longer wanted, dispose it right away instead of leaving it in the cache.
4. **Turn off mipmaps on the background** (`generateMipmaps = false`, `minFilter =
   LinearFilter`). The background is viewed at about 1:1, so mipmaps cost 33% for nothing.
   Check for shimmer on the flat-screen view, which is downscaled; revert if it looks bad.
5. **Smaller backgrounds on flat screens.** Load a `2k` JPG (2048×1024, cube faces 1024) when not
   immersive and the 4k one in VR. When entering VR, upgrade and free the 2k version.
   `fetch-hdris.mjs` gains a 2k output.

Expected result: about 171 MiB in VR and about 43 MiB on screen, steady, instead of growing
without limit. That should stop the crashes. Main-thread stalls remain until Phase 2.

### Phase 2: GPU-ready backgrounds (proper fix; 2–3 days including the spike)

Ship each place as a **KTX2 cube map**: six square faces, Basis-compressed, mipmaps baked in.
Load it with three's `KTX2Loader`, which transcodes in a Web Worker.

- **No JPEG decode and no cube conversion** on the main thread. The upload is already in the
  GPU's compressed format: ASTC on Quest and Android, BC7/S3TC on desktop.
- **GPU memory** at 2048² faces is about 32 MiB with mipmaps (UASTC → ASTC 4×4, 1 byte per
  pixel), or about 16 MiB with ETC1S. Today's 4k JPG path costs about 171 MiB.
- **Sharpness:** a 2048 face covers 90°, which is about 23 px/degree. That matches the Quest 3
  display, so it looks as good as the old 8k upgrade without its cost.

Work:

1. **Spike S5: can we own `scene.background`?** `EnvironmentSystem` only understands
   `.jpg/.png/.hdr/.exr` sources, so a KTX2 cube map has to bypass `DomeTexture`.
   - Check that setting `scene.background` and `backgroundRotation`/`backgroundIntensity`
     directly holds when the level root has no `DomeTexture`, and that `DomeGradient` (the
     loading fallback) doesn't overwrite it.
   - If it does overwrite it, remove `DomeGradient` once the first place is ready.
   - Otherwise, fall back to an inside-out cube mesh created with `world.createTransformEntity`
     (`depthWrite: false`, rendered first).
2. **Spike S6: encoder and file size.**
   - Choose an encoder that runs in Node with no system install, so CI keeps working. Options:
     a Basis Universal WASM encoder from npm, or `toktx` from KTX-Software downloaded in CI.
   - Compare ETC1S and UASTC+zstd on the dawn and night skies, which are most prone to
     banding.
   - Download size is the trade-off: ETC1S should be about 2–4 MB per place, while UASTC could
     be 8–15 MB. Pick per place if needed, and record the numbers here.
3. **Build step** (`scripts/build-cubemaps.mjs`, run from `prebuild`/`predev` after
   `fetch-hdris`):
   - Reproject the Poly Haven tonemapped JPG into six faces using sharp raw pixels and bilinear
     sampling (about 100 lines).
   - Encode the faces with mipmaps to `public/hdri/{id}_cube.ktx2`, plus a `{id}_cube_1k.ktx2`
     for phones.
   - Add the outputs to `credits.json` (they are derived from CC0 sources) and to
     `check-credits`.
4. **Runtime:**
   - `PlaceSystem` loads the KTX2 with a single shared `KTX2Loader`. Call `detectSupport(renderer)`
     once, and copy the transcoder from `three/examples/jsm/libs/basis/` to `public/basis/`.
   - Set the result as `scene.background`, using the same yaw formula. Check that the cube face
     order still matches `yawForFocus` with the labelled test panorama from the original
     calibration.
   - Pick the face size from device and immersion: 2048 in VR, 1024 on phones and flat screens.
   - Keep the Phase 1 dispose and queue logic.
   - Fallback when KTX2 fails to load: the Phase 1 JPG path.
5. **Prefetch the likely next place** only while idle and on screen. Never prefetch during a
   session or in VR, and keep at most one extra place in memory.

### Phase 3: Cheaper lighting (½ day)

IBL only lights the orb, the mat and the cushion, so a 1k HDR per place (about 1.6 MB download,
parsed on the main thread, plus PMREM) is more than these need.

- At build time, sample each panorama's average sky, horizon and ground colours into
  `places.json`.
- At runtime, use `IBLGradient` with those colours instead of `IBLTexture`, so nothing is
  downloaded. Fade by writing `scene.environmentIntensity` as today.
- If the orb looks flat, use a 256×128 HDR instead (about 100 KB) and dispose its source after
  PMREM.

### Phase 4: Startup work (1 day)

1. **Bake the VR font at build time.**
   - Generate the MSDF atlas and JSON with `msdf-bmfont-xml` (or the generator UIKit's own
     tooling uses) in `scripts/build-font.mjs`.
   - Point `fontFamilies` at the baked JSON instead of running `TTFLoader` at runtime.
   - Spike first: confirm the JSON shape UIKit expects for a prebuilt font.
2. **Load VR-only things only for VR.** Defer the font and the five UIKitML panels until "Begin
   in VR" is shown or `xrSupported` is true. Flat-screen users never pay for them.
3. **Audio.** Generate each noise colour only when an ambient that uses it is picked, not all of
   them at unlock. Spread the work over idle callbacks if Phase 0 shows it matters.
4. **Bundle.** Check the `npm run build` output for chunk sizes. If the IWSDK, three or UIKit
   chunk is large, make sure the overlay and the menu render before it finishes downloading
   (the place-card thumbnails are already plain images).

### Phase 5: Keep it fixed

- Commit the soak script and the perf probe. Add a CI job that runs the soak in the headless
  emulator and fails if texture memory after 30 switches is more than 10% above the value after
  the first switch.
- Add a short "Performance budget" section to `README.md` that copies the targets table above.
- Run the soak on a Quest before each release.

## Order and effort

| Phase | Effort | Fixes |
|---|---|---|
| 0 Measure | ½ d | Confirms the cause and gives a baseline |
| 1 Stop the leak | ½–1 d | **The crashes** (expected) |
| 2 KTX2 cube maps | 2–3 d | Stalls while loading; memory down a further ~5×; VR sharpness |
| 3 Gradient IBL | ½ d | 1.6 MB download and a main-thread parse per place |
| 4 Startup | 1 d | Seconds of font generation at startup; work flat screens don't need |
| 5 Guardrails | ½ d | Regressions |

Phase 1 alone should make the app stable, so do it first and test it on a Quest before
starting Phase 2.

## Risks and open questions

- **Cause not yet proven.** The crash hasn't been reproduced yet. If Phase 0 shows a different
  cause (for example an IWSDK or IWER issue, or audio), re-plan from the measurements.
- **Which device crashed?** Desktop Chrome, a phone, or a Quest. The fix is the same, but the
  targets and the device used for verification depend on it.
- **KTX2 download size versus quality.** ETC1S may band on smooth skies. UASTC looks better but
  downloads 3–4× more. Spike S6 decides.
- **IWSDK ownership of the background** (Spike S5). A future IWSDK release may support KTX2 in
  `DomeTexture`. If it does, switch back to the component.
- **Cube face orientation.** The face order and handedness have to match three's cube
  convention, or the view will be mirrored or rotated. Re-run the labelled-panorama calibration.

## Outcome

### Measurements (headless Chromium + IWER Quest 3 emulator, `npm run soak`)

18 place switches (all six places, three rounds). GPU texture memory is counted by
`src/perf/gpu-memory.ts`, which wraps the WebGL texture calls.

| | Before | After, VR | After, flat screen |
|---|---|---|---|
| GPU textures after the first switch | 1 792 MiB | 93 MiB | 16 MiB |
| GPU textures after 18 switches | **5 221 MiB** | **93 MiB** | **16 MiB** |
| Growth across the soak | ×2.91 | ×1.00 | ×1.00 |
| Worst frame during switches | **728 ms** | 25–35 ms | 27 ms |
| Frames over 50 ms | 10 | 0 | 0 |
| Download per place (background) | 1–3 MB 4k JPG + 3–10 MB 8k JPG + 1.6 MB HDR | 3.6–6.3 MB (2k cube) | 1.1–1.7 MB (1k cube) |
| Entry script before the menu shows | 676 KB gz | 13 KB gz (engine loads after) | same |

The 93 MiB in VR breaks down to the 16 MiB background, 2 × 10.7 MiB font atlases, 6 MiB
lighting, and 2 × 21 MiB that belong to the emulator's eye buffers (a Quest's compositor
allocates those outside WebGL, so the real figure is lower).

The cause was confirmed: before the fix, each place visited in VR added ~860 MiB (the 4k and
8k JPGs plus the uncompressed cube maps three.js builds from them), and none was ever freed.

### What was done

- **Phase 0.** `src/perf/gpu-memory.ts` (texture-memory accounting) and
  `src/systems/perf-probe-system.ts` (frame times plus a soak via Shift+P, `?soak` or
  `perf.soak()`); both are on in dev, or with `?perf` / `?soak` in any build.
  `scripts/soak.mjs` drives it through the IWSDK CLI.
- **Phases 1 and 2 together.** `PlaceSystem` was rewritten:
  - one load at a time, with a 250 ms debounce;
  - superseded results are disposed;
  - the previous background is disposed after each swap;
  - the 8k upgrade and the `hd` pref are gone.

  Backgrounds are Basis ETC1S cube maps (`*_cube.ktxc` at 2048² for VR, `*_cube_1k.ktxc` for
  screens), transcoded in KTX2Loader's worker and set directly as `scene.background`. A 2k JPG
  remains as the fallback.
- **Phase 3.** Lighting is an `IBLGradient` coloured from the panorama
  (`src/data/place-light.json`, written by `build-cubemaps.mjs`); the per-place HDR is gone.
- **Phase 4.**
  - The VR font is only built on devices that can enter VR, once the first place is on
    screen.
  - The 2D menu no longer waits for IWSDK: `src/world.ts` is a separate chunk, and Begin is
    disabled until the first place shows.
- **Phase 5.**
  - CI caches the encoded cube maps and runs the soak as a non-blocking job.
  - The README has a "Performance budget" section.

### Spike answers and deviations

- **S5 (owning `scene.background`):** works. With no `DomeTexture` or `DomeGradient` on the
  level, `EnvironmentSystem` only clears backgrounds it set itself. `PlaceSystem` removes the
  `DomeGradient` (the loading backdrop) when the first place is applied.
  - Side effect: IWSDK's XR recenter yaw compensation no longer applies to the background.
    After a Quest recenter, the place turns with the user, which suits a seated practice.
- **Orientation:** the cube faces are generated so the old `yawForFocus` still holds.
  - Checked numerically: comparing the sky above the menu against the old JPG gives a mean
    squared error of 0.7, against 800–1100 for mirrored or shifted copies.
- **S6 (encoder):** `ktx2-encoder` (Basis WASM, npm, no system install).
  - Its encoder caps a texture at ~12 Mpix, so a 6 × 2048² cube can't be one KTX2. Each face
    is its own KTX2, and the six are packed into one `.ktxc` file (format in
    `build-cubemaps.mjs`), assembled into a `CompressedCubeTexture` at runtime.
  - ETC1S gives 3.6–6.3 MB per place; UASTC+zstd gave 19–25 MB, so ETC1S was chosen.
  - Encoding takes about a minute per place, cached in CI.
- **Font (Phase 4.1) not baked at build time.** Measuring showed the MSDF generation already
  runs in a Web Worker (UIKit's `TTFLoader`), so it doesn't stall frames. Deferring it, and
  skipping it entirely on devices without VR, covered the cost with far less machinery.
- **Audio (Phase 4.3):** no change needed. Noise buffers were already generated per colour on
  first use and cached.
- **Mipmaps:** kept. The ETC1S cube maps carry pre-built mipmaps at no runtime cost.

### Still open

- **Run on a real Quest 3.**
  - Open the site with `?soak`, or run `npm run soak` against a paired headset.
  - Check the 50 ms frame target and the ETC1S quality on the dawn and night skies; they look
    fine in the emulator, but banding is the known ETC1S risk.
- **Watch the CI soak job** on GitHub's runners, and make it blocking once it is stable.
- **Large world chunk.** It is 664 KB gzipped (IWSDK + three + UIKit). Splitting it further
  would mean changes inside IWSDK.
