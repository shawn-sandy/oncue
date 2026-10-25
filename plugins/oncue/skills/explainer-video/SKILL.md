---
name: explainer-video
description: OnCue end to end. Make a short vertical explainer, from a topic to a storyboard, an ElevenLabs voiceover, a native 9:16 PowerPoint deck and a word-synced animated MP4 for YouTube Shorts, Reels or TikTok. Use when the user asks to make an explainer video, a product short, a 9:16 presentation they can turn into a video, or "a video like the Gleaner one", or names this plugin.
argument-hint: '[topic, product, or path to short.json]'
---

# Explainer video

Run the whole pipeline. Each stage has its own skill; this one sets up the engine, orders the stages, and keeps the person in the loop at the two points that are expensive to redo: the beats (before audio) and the voice (before rendering).

| Stage | Skill | Output |
| --- | --- | --- |
| 1. Storyboard | [storyboard](../storyboard/SKILL.md) | `short.json`, a beat list, preview stills or a Design canvas |
| 2. Voiceover | [voiceover](../voiceover/SKILL.md) | `voiceover.mp3`, `words.json` (word timings) |
| 3. Deck | [vertical-deck](../vertical-deck/SKILL.md) | `deck.pptx`, 9:16, voiceover in the speaker notes |
| 4. Video | [animate-short](../animate-short/SKILL.md) | `short.mp4`, 1080×1920, every element entering on its word |

The deck and the video both read `short.json`, so they always match. The deck can be built any time after stage 1; the video needs stage 2 for real audio, or renders a silent preview from estimated timing without it.

## Set up the engine (once per session)

The engine is a typed Node program in this plugin's `engine/` folder (`../../engine` from this skill's folder). If `oncue-engine/` already exists in the working directory (the setup skill, `../setup/SKILL.md`, makes it), reuse it with `cd oncue-engine && npm install`; copying over it would nest the engine inside it. Otherwise copy it into the working directory rather than running it inside the plugin, so installs never touch the plugin cache:

```bash
cp -R <plugin>/engine ./oncue-engine && cd oncue-engine && npm install
```

Requirements: Node 22+, `ffmpeg` and `ffprobe` on `PATH`, and Playwright with Chromium for the video and stills. If `node -p "require('playwright/package.json').version"` prints 1.40.0 or later (many sandboxes preinstall it), use that and do not install another version. Otherwise run `npm install --save-dev playwright && npx playwright install chromium` in `oncue-engine`; keep `--save-dev`, because npm 12 skips optional peers otherwise. The deck needs no browser.

Run every command from `oncue-engine`. `npm run example:check` confirms the install on the bundled Gleaner example.

## Order of work

1. Start with a one-line plan, then gather material and build the storyboard. Show it and ask the person to approve or change the beats. **Do not record audio before they approve**, unless they said to go ahead without stopping.
2. Generate the voiceover. Tell them the voice you picked, give them both takes, and pick one for timing (ask which they prefer if they are present; otherwise take the first and say so).
3. Build the deck if they want a presentation or an editable source; it is quick.
4. Render the video. Run stills first and look at them, then the full render in the background.
5. Deliver: send the MP4 (and the deck), copy them to the folder the person named on their computer when one is linked, and say in one or two lines what they got, which take and voice, and what it cost in ElevenLabs credits.

## Things that went wrong before

- **Sandbox network.** Many sessions block downloads from ElevenLabs' file host `storage.googleapis.com`. If a download is refused, tell the person to add that domain under claude.ai Settings → Capabilities, or to attach the MP3. Do not retry through other tools.
- **Transcribe, don't guess.** Pauses between lines are no longer than pauses inside them, so splitting audio on silence puts cuts mid-sentence. Always time from a word-level transcript (the voiceover skill gets one).
- **Long renders.** About 3–4 frames a second, so roughly 10 minutes for a 75-second video. Run it in the background and keep the person posted at milestones.
