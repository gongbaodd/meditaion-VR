# Research notes

_Collected 2026-11-11. "Verified" = read on the source page or returned by the live API
that day. "Unverified" = not confirmed; check before relying on it._

## 1. IWSDK (Meta Immersive Web SDK)

Docs version read: **v0.5.3** (pages updated 2026-09-04).

- **Create:** `npm create @iwsdk@latest` → project name → *Virtual reality* / *Mixed reality* / *Desktop 3D* → recommended or customize (TS/JS, locomotion, grabbing, physics, scene understanding, git init, install).
- **Node:** 20.19+, 22.12+ or 24+.
- **Generated project:** `iwsdk.config.json`, `index.html`, `vite.config.ts` (`iwsdkDev()` plugin), `public/scenes/main.iwsdk.scene.json`, `public/ui/welcome.uikitml`, `src/{assets,components,index,panel}.ts`.
- **Entry:** `World.create(container, projectOptions)` with `projectOptions` from `virtual:iwsdk-project`; then `world.registerSystem(...)`.
- **Manifest:** `world.xr` (`mode`, `offer`, `features.handTracking`…), `world.features` (`locomotion`, `grabbing`, `spatialUI`, physics…), `world.render`, `world.input`.
- **Dev:** `npm run dev` serves **HTTPS** (self-generated cert) e.g. `https://localhost:5173/`; IWER emulator in desktop browser, device via `"dev": {"emulator": {"device": "metaQuest3"}}`. Headset: same Wi-Fi + Network URL, or ADB port forward.
- **Environment:** `DomeGradient {sky, equator, ground, intensity}`, `DomeTexture {src, intensity, blurriness}`, `IBLGradient {…}`, `IBLTexture {src, intensity, rotation}` from `@iwsdk/core`, added to `world.activeLevel.value`. Dome = visible only; IBL = lighting only; add both.
- **Assets:** `defineAssets` entries `{name, type, url, priority}`; `AssetType`: `GLTF`, `Texture`, `HDRTexture` (HDR/EXR), `Audio`, `UIKitML`; priority `critical` (blocks `World.create`) / `background` / `lazy`; 30 s timeout per asset.
- **UI:** UIKitML files (`<style>` + markup: `Panel`, `h1`, `button`…), registered as `AssetType.UIKitML`, placed in scene with `RayInteractable`; events via `world.getSceneObject<UIKitMLAsset>(id).getElementById(...)`. `world.launchXR()` enters XR.
- **ECS:** `class X extends createSystem({...}) { init() {} }`.
- **Unverified / not found in pages read:** audio component API, runtime environment swap, KTX2 or LDR dome textures, exact `xr.mode` values. Docs disagree on whether a default environment/lighting is injected (newer page: no).

## 2. Poly Haven HDRIs

- Assets are **CC0**; no attribution needed. 997 HDRIs listed by the API on 2026-11-11.
- API: `GET https://api.polyhaven.com/assets?type=hdris`, `GET /files/{id}` → `hdri.{1k|2k|4k|8k|…}.{hdr|exr}.{url,size,md5}` (+ `tonemapped`). No key. Requests need a **unique User-Agent**.
- Download URLs: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/{res}/{id}_{res}.hdr` — take the `url` from `/files`, 16k+ lives in a different folder.
- API terms: free for any purpose; live-API use in a product needs a visible credit ("Powered by Poly Haven") and identifying Referer/UA; that clause doesn't apply to assets once downloaded/self-hosted.
- Measured sizes (`kloofendal_48d_partly_cloudy_puresky`, `.hdr`): 1k 1.4 MB · 2k 5.3 MB · 4k 20 MB · 8k 73 MB. EXR is ~4× larger.

## 3. Sound sources

| Source | Licence situation | Practical use |
|---|---|---|
| **Freesound** | Per sound: CC0, CC BY, CC BY-NC. API filter `filter=license:"Creative Commons 0"`. Token auth for search/previews (`preview-hq-mp3` ~128 kbps, `preview-hq-ogg` ~192 kbps); **original files need OAuth2**. Burst + daily rate limits. | Primary source for bowls, bells, rain, ambience. Curate by hand, download originals logged in, self-host. |
| **Internet Archive** | Per item (`licenseurl` metadata); searchable via advanced search with `mediatype:audio`. Automated requests need a descriptive User-Agent. | Secondary; verify each item. Download URL pattern and CORS unverified. |
| **Free Music Archive** | Per track. Usable: CC0, CC BY, CC BY-SA. Not usable: NC, ND, "FMA-Limited". | Optional music pads. |
| **Pixabay Music** | Free, no attribution, but **no standalone redistribution** of unmodified content. | Don't commit raw tracks to a public repo. Avoid. |
| **incompetech** | "Creative Commons — free, credit required". Exact CC version unverified from the page read. | Optional; follow the credit text on each track's page. |

## 4. Meditation apps and content

| Source | What it offers | Licence |
|---|---|---|
| **Medito** | Flutter app. Guided meditations, courses (incl. 30-day), daily session, sleep stories/sounds, breathing exercises, unguided timer with ambient sounds, choice of voice. | Code AGPL-3.0; content custom, **not open source**. |
| **UCLA Mindful** | Short fixed set repeated in ~18 languages: Short Body Scan 3 m, Body & Sound 3 m, Breathing 5 m, Working with Difficulties 7 m, Loving Kindness 9 m, Breath-Sound-Body 12 m, Body Scan for Sleep 13 m, Complete Instructions 19 m. | CC BY-NC-ND 4.0 |
| **Palouse Mindfulness** | Full 8-week MBSR: wk1 body scan, wk2 sitting, wk3 yoga, wk4 stress/breathing space, wk6 lake & mountain, wk7 lovingkindness. Body scan 32 m (20 m alt), sitting 32 m (20 m alt), yoga 37 m, mountain 20 m, lake 20 m, silent 30 m. | All rights reserved |
| **Audio Dharma** | Large guided-meditation list, mostly Gil Fronsdal; 5–45 min; filter buckets <10, 10–30, 30–60, >60 min. | CC BY-NC-ND 4.0 |
| **Dharma Seed** | Talks by teacher/retreat. | CC BY-NC-ND 4.0 |
| **Free Mindfulness Project** | Breath 3–10 m, brief practices 3–6 m, body scans 4–48 m, sitting 10–21 m, mountain 7–8 m, **bell-only self-guided tracks** 5/10/20 m and interval-bell tracks (bell every 5 or 15 min) up to 45 m. | CC BY-NC-SA 3.0 |

**Takeaways for our design**

- Short lengths dominate entry-level content: 3, 5, ~10, ~20 min → our four lengths.
- The same small set of practices recurs everywhere: breath, body scan, breath-sound-body / open sitting, loving-kindness, sleep.
- Bell-only and interval-bell sessions are an established format → a voice-free v1 is legitimate.
- Medito's separation of guidance, background sound and timer → independent ambient/bell/guide channels.
- None of the guided audio is licensed for bundling + mixing → write our own guidance.

## Sources

- IWSDK: <https://developers.meta.com/horizon/documentation/iwsdk/guides/01-project-setup/> · <https://developers.meta.com/horizon/documentation/iwsdk/guides/05-environment-lighting/> · <https://developers.meta.com/horizon/documentation/iwsdk/guides/04-external-assets/> · <https://developers.meta.com/horizon/documentation/iwsdk/guides/overview/> · <https://developers.meta.com/horizon/documentation/iwsdk/guides/10-spatial-ui-uikitml/>
- Poly Haven: <https://polyhaven.com/hdris> · <https://github.com/Poly-Haven/Public-API> · <https://api.polyhaven.com/api-docs/swagger.json> · <https://polyhaven.com/license>
- Freesound: <https://freesound.org/docs/api/resources_apiv2.html> · <https://freesound.org/docs/api/authentication.html>
- Internet Archive: <https://archive.org/advancedsearch.php> · <https://archive.org/developers/>
- FMA: <https://freemusicarchive.org/License_Guide> · Pixabay: <https://pixabay.com/service/license-summary/> · incompetech: <https://incompetech.com/music/royalty-free/licenses/>
- Medito: <https://github.com/meditohq/medito-app> · <https://meditofoundation.org/medito-app> · <https://meditofoundation.org/license>
- UCLA Mindful: <https://www.uclahealth.org/uclamindful/guided-meditations>
- Palouse: <https://palousemindfulness.com/MBSR/> · <https://palousemindfulness.com/meditations/index.html>
- Audio Dharma: <https://www.audiodharma.org/> · Dharma Seed: <https://dharmaseed.org/>
- Free Mindfulness: <https://www.freemindfulness.org/download>
