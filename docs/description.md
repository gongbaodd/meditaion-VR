# Still Places

## Inspiration

I caught a severe cold in the middle of a dark winter. The days were short and grey, I was stuck indoors, and what I really wanted was somewhere warm and sunny to rest and recover. I couldn't travel, but I had a VR headset.

So I built the place I needed: put on the headset and you're sitting on a sunny beach, in a bright meadow or by a quiet lake at dawn. You hear the waves or the birds, and you're guided to breathe slowly. It's a small escape for when your body needs rest and the weather outside won't help. I made it a web page, with no install and no account, so it's easy to open when you're feeling low.

## What it does

**Still Places** is a meditation website that runs in a VR headset through WebXR, or in any browser tab.

- **6 places:** dawn mountain, forest, lake, beach sunrise, meadow and starry night. Each is a full 360° panorama that also lights the scene.
- **Guided breathing:** a glowing orb grows and shrinks to pace each breath, so you can follow it with your eyes half-closed.
- **3, 5, 10 or 20 minutes.** Every session follows the same shape: arrive → settle → anchor → main practice → close, with short text cues and a closing bell.
- **Sound:** singing bowls plus rain, forest, waves, stream or night ambience, all synthesized live in the browser.
- **A place hub:** in VR you stand inside a ring of "windows". Each one previews a place, and you turn a dial to browse them and step into the one you like.
- **Hand menu:** turn your palm toward your face and a small menu appears beside your hand. You can pause, change the length or start a session without controllers.
- **No accounts and no backend.** Your preferences and session history stay on your device.

## How I built it

- **Meta's Immersive Web SDK (IWSDK)** with TypeScript and Vite, using its ECS (entity-component system) architecture. Separate systems handle the place, the session clock, the breathing orb, the VR panels, the hub and the hand menu.
- **Poly Haven CC0 HDRIs** for the places. A build script downloads them, resizes them into 4K/8K backgrounds plus small HDR files for lighting, and converts them to compressed cube maps.
- **Spatial UI written in UIKitML** for the VR panels, and a plain HTML overlay for flat screens.
- **Web Audio** It schedules bells and cross-fades ambience beds, and synthesizes all sound procedurally, so there are no audio files to license.

## Challenges I ran into

- **GPU memory crashes.** Each 360° background is quietly turned into a large uncompressed cube map. One 8K place cost about 680 MiB, and the tab crashed after two or three place changes on a headset. I measured the problem, moved to pre-built compressed cube maps, and made sure old textures are actually freed.
- **Motion sickness in the hub.** My first ring of windows slid around you as you turned the dial. That sideways motion at the edge of your view (vection) made people dizzy. I tried a card-deck layout and dropped it. The final design keeps the windows still: they fade out, swap places while nothing is visible, and fade back in.


## Accomplishments that I'm proud of

- A calm, complete experience: pick a place, sit, breathe and finish with a summary. The UI disappears during the session.
- It's comfort-first: you stay seated, there's no locomotion, and nothing moves the camera.


## What I learned

- In VR, what feels calm matters more than what looks impressive. Small motion choices decide whether people feel relaxed or sick.
- High-resolution textures on the web cost much more GPU memory than their file size suggests. Measure before you guess.
- The emulator saved a lot of time, but it can't tell you how something feels.

## What's next for Still Places


- Voice guidance as an alternative to text cues.
- Hand-picked CC0 field recordings to go with the synthesized soundscapes.
- More places and practices, and maybe places from your own 360° photos.
- Deploy publicly and package it as an installable PWA for the Meta Horizon Store.
