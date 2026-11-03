---
name: explainer-video
description: OnCue end to end. Make a short explainer, vertical 9:16 or widescreen landscape 16:9, from a topic to a storyboard, an ElevenLabs voiceover, a native PowerPoint deck and a word-synced animated MP4 for YouTube Shorts, Reels, TikTok or a YouTube video. Use when the user asks to make an explainer video, a product short, a wide screen or 16:9 YouTube video, a presentation they can turn into a video, or "a video like the Gleaner one", or names this plugin.
compatibility: 'Text planning can use supplied sources alone. Rendering needs Node.js 22+ and the bundled engine; stills/video need Playwright Chromium, video needs ffmpeg, audio timing needs ffprobe. Use ElevenLabs creative tools or supplied audio with matching timestamps.'
argument-hint: '[topic, product, or path to short.json]'
---

# Explainer video

Run the whole pipeline. Each stage has its own skill; this one sets up the engine, orders the stages, and keeps the person in the loop at the two points that are expensive to redo: the beats (before audio) and the voice (before rendering).

| Stage | Skill | Output |
| --- | --- | --- |
| Research (optional, any stage) | [research](../research/SKILL.md) | `research.md`: ranked topic ideas, sourced facts, narration rewrites and visual ideas |
| 1. Storyboard | [storyboard](../storyboard/SKILL.md) | `short.json`, a beat list, preview stills or a Design canvas |
| Visuals (optional, any stage) | [visuals](../visuals/SKILL.md) | `images/` and `image` beats: the person's screenshots, drawn diagrams or licensed pictures, safe to add after the voiceover |
| Interactive editing (optional) | [storyboard-editor](../storyboard-editor/SKILL.md) | Browser editor and exported `short.json`; validate and render stills before approval |
| 2. Voiceover | [voiceover](../voiceover/SKILL.md) | `voiceover.mp3`, `words.json` (word timings) |
| 3. Deck | [vertical-deck](../vertical-deck/SKILL.md) | `deck.pptx`, 9:16 or 16:9, voiceover in the speaker notes |
| 4. Video | [animate-short](../animate-short/SKILL.md) | `short.mp4` at the spec's size (1080×1920, 1920×1080 or custom), every element entering on its word |

The deck and the video both read `short.json`, so they always match. Its `format` sets the shape: 1080×1920 for Shorts, Reels and TikTok, 1920×1080 for a YouTube video, or a custom size; the storyboard skill picks it from where the video will be posted. The deck can be built any time after stage 1; the video needs stage 2 for real audio, or renders a silent preview from estimated timing without it.

## Set up the engine (once per session)

Use the setup skill (`../setup/SKILL.md`) as the source of truth for this host: resolve the loaded plugin and version, then follow its Node, engine and browser checks (sections 2–5). Keep the person's existing installation and account settings unless they asked to change them. No generation or transcription is needed to check readiness.

Without shell execution, Node 22+ or a writable workspace, keep research and the text storyboard available, return drafts in the reply, and report engine checks as not run. Missing ffmpeg, ffprobe or a browser does not block spec checks or decks when their own requirements are ready.

The engine is bundled at `../../engine` from this skill's folder. Setup copies it into a writable `oncue-engine/`, compares an existing copy against the loaded version before reusing it, and preserves an older copy when replacing it. Follow that procedure rather than copying into an existing folder or installing into the plugin cache. A failed comparison is a path/read error, not evidence that a copy is outdated.

Run engine commands from that writable copy. `npm run example:check` must print `OK.` before claiming the engine is ready. For stills or video, setup checks the Playwright package and tries the actual browser. Reuse a verified installed executable through `ONCUE_CHROMIUM_PATH`; download Playwright's matched Chromium only where that download is permitted and needed. The override still requires Playwright. Do not run a browser download merely because the package was missing when an installed executable is already selected.

Video additionally needs ffmpeg; voice-timed stills and final audio need ffprobe plus matching audio and word timestamps. Report available outputs separately. The voiceover stage checks supported connector tools or accepts supplied files; do not connect an account or spend credits during engine setup.

## Order of work

1. Start with a one-line plan, then gather material and build the storyboard. For interactive design, apply [storyboard surface routing](../setup/SKILL.md#storyboard-surface-routing); choose from verified host capabilities and reuse the existing editor. Show it and ask the person to approve or change the beats. **Do not record audio before they approve**, unless they said to go ahead without stopping.
2. Generate the voiceover. Tell them the voice you picked, give them both takes, and pick one for timing (ask which they prefer if they are present; otherwise take the first and say so).
3. Build the deck if they want a presentation or an editable source; it is quick.
4. Render the video when its required capabilities are ready; otherwise report which outputs are available. Run stills first and look at them, then the full render in the background.
5. Deliver: send the MP4 (and the deck), save copies to the folder the person named when this session can write there, and say in one or two lines what they got, which take and voice, and what it cost in ElevenLabs credits.

## Things that went wrong before

- **Sandbox network.** Many sessions block downloads from ElevenLabs' file host `storage.googleapis.com`. If a download is refused, use the recovery instructions for this host in the setup skill (`../setup/SKILL.md`), or ask the person to attach the MP3 and matching word timestamps. Do not retry through other tools.
- **Transcribe, don't guess.** Pauses between lines are no longer than pauses inside them, so splitting audio on silence puts cuts mid-sentence. Always time from a word-level transcript (the voiceover skill gets one).
- **Long renders.** Speed depends on the machine: on an Apple M4 Max the 75-second example rendered at about 30 frames a second, in 76 seconds, and slower machines take longer. Run it in the background and keep the person posted at milestones.
