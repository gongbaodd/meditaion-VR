# Still Places — intro video

A 3-minute introduction to Still Places, built with [Remotion](https://www.remotion.dev/).
The script is in [`../docs/video-script.md`](../docs/video-script.md).

## Setup

The footage comes from the headset recordings in `../docs/records/`. Neither that folder nor
`public/footage/` is committed. Re-encode the recordings once (HEVC with a variable frame rate →
H.264 at a constant 30 fps, with a keyframe every half second so seeking stays fast):

```sh
npm i
mkdir -p public/footage
ffmpeg -i ../docs/records/AQM2*.mp4 -vf "fps=30,scale=1080:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -crf 18 -g 15 -c:a aac -b:a 192k -ar 48000 -movflags +faststart public/footage/A.mp4
ffmpeg -i ../docs/records/AQOO*.mp4 -vf "fps=30,scale=1080:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -crf 18 -g 15 -c:a aac -b:a 192k -ar 48000 -movflags +faststart public/footage/B.mp4
```

- **A**: Sunrise Shore session, then the hub and other places (7:38)
- **B**: hub → Mountain Dawn session, Forest Light, and the setup panel on the beach (3:20)

## Work on it

```sh
npm run dev                                   # Remotion Studio
npx remotion render StillPlacesIntro out/still-places-intro.mp4 --crf=18
```

- `src/theme.ts`: scene lengths, colours, `SITE_URL` (the URL on the end card)
- `src/StillPlacesIntro.tsx`: the scene order, the fades between scenes, and the soundtrack
- `src/scenes/S1…S9`: one file per scene, each also registered on its own under "Scenes" in the Studio

The soundtrack is the app's own sound (synthesized waves and singing bowls) taken from recording A.
It is lined up so that the session's three closing bowls ring under the end card.
