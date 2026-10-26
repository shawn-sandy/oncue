---
name: animate-short
description: Render a short.json explainer as an animated MP4, vertical 1080×1920 for Shorts, Reels and TikTok or widescreen landscape 1920×1080 (16:9) for a YouTube video, where every card, step, tile and timestamp enters on the word the voiceover says, with typing, spotlight glows, drawn lines, scene transitions and a progress bar. Use when the user wants the video rendered, animation added to slides "to keep interest", a silent preview, or the final Short, Reel, TikTok or YouTube video file.
argument-hint: '[path to short.json]'
---

# Animate a short

Render `short.json` into an MP4 at its `format` size. Each scene is an HTML page driven frame by frame in headless Chromium, so every frame is exact and repeatable; ffmpeg encodes the frames and lays in the voiceover.

## Inputs

- `short.json` and its logo (storyboard skill, `../storyboard/SKILL.md`).
- For the final video: `voiceover.mp3` and its word-timestamped transcript `words.json` (voiceover skill, `../voiceover/SKILL.md`). Without them you get a **silent preview** with timing estimated from the script; label it as such.

Set up the engine as in `../explainer-video/SKILL.md`. Video needs Playwright with Chromium and ffmpeg.

## 1. Check stills first

```bash
node dist/cli.js stills <folder>/short.json --words <folder>/words.json --audio <folder>/voiceover.mp3
```

This writes one frame per scene (85% of the way through it) to `build/stills/`; pass `--at 3.5,12,20` for specific seconds. Combine them into a contact sheet and look at it:

- Text fits its card. In a portrait frame, nothing sits in the bottom ~350px (Shorts UI).
- No `warning: scene N (...) shrunk to ...` lines. The engine shrinks a scene that overflows its frame, which happens most at sizes other than 9:16 and 16:9, and records every scene in `build/fit.json`. A shrunk scene still shows everything, smaller; cut its copy (fewer items, shorter titles) to show it full size.
- Each scene shows what its line is saying at that moment.
- No warnings about cue words. A warning means an element is spaced evenly instead of landing on its word; fix the cue in `short.json`.

## 2. Render

```bash
node dist/cli.js video <folder>/short.json --words <folder>/words.json --audio <folder>/voiceover.mp3 --out <folder>/short.mp4
```

Expect 3–4 frames a second: about 10 minutes for 75 seconds at 30fps. Run it in the background and report progress at milestones; render several takes in parallel when the person wants to compare voices.

The output is H.264 with AAC audio at the spec's size, starting 0.3s before the first word and holding 1.6s on the last scene.

## 3. Verify and deliver

Probe the file (`ffprobe` for the spec's `format` size, 30fps, an audio stream) and grab a frame from each scene with `ffmpeg -ss <t> -frames:v 1` to confirm the encoded video, not only the stills. Then send it, and copy it to the person's folder when their computer is linked.

Say what is in it in a sentence or two, and offer one next step: burned-in captions (most Shorts are watched muted; the word timings are already there), a different take, or edits to the copy.

## What the animation does

Built in, no configuration: elements slide, pop or fade in on their cue word; the newest item glows in the brand highlight for about a second; "you" chat turns type themselves out; strings and step connectors draw down; each scene pushes in and drifts slowly while it holds; soft background light drifts; the logo floats; a progress bar runs along the top. Change the look through `brand` in `short.json`, not by editing the generated HTML.
