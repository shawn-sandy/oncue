---
name: setup
description: Get OnCue ready to run. Check Node, ffmpeg and ffprobe, set up the engine with Playwright and Chromium, check the ElevenLabs connector, fix what can be fixed in the session, and report which outputs (storyboard, deck, stills, voiceover, video) will work. Use when the user has just installed the plugin, asks to set up or check OnCue, asks what they need to make a Short, or a stage failed because Playwright, ffmpeg or ElevenLabs is missing.
---

# Setup

Check what OnCue needs on this machine and in this session, fix what you can, and say which outputs are ready. Nothing here spends ElevenLabs credits: never call a generation or transcription tool during setup.

Work through the checks in order and keep going past a failure, so the report covers everything at once.

## 1. Node.js

```bash
node --version
```

Every stage needs 22 or newer. If it is older or missing, tell the person to install Node 22+ (nodejs.org or their version manager), skip steps 3 and 4, which need it, and still run steps 2 and 5 and the report.

## 2. ffmpeg and ffprobe

```bash
ffmpeg -version | head -1
ffprobe -version | head -1
```

Each must print a version line; `command not found` names the one that is missing. Check them separately: `command -v ffmpeg ffprobe` exits 0 in bash even when one is missing. The video needs ffmpeg, and anything timed to a real voiceover (stills or video with `--audio`) needs ffprobe. One package installs both: `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian or Ubuntu. Ask before installing; anything with `sudo` the person runs themselves. Without ffmpeg the storyboard, the deck and silent preview stills still work.

## 3. The engine

The engine is in this plugin's `engine/` folder (`../../engine` from this skill's folder). Below, `<plugin>` is the absolute path of the folder two levels above this skill's folder, the one holding `engine/` and `skills/`.

If `oncue-engine/` already exists in the working directory, reuse it: `cd oncue-engine && npm install`. Copying over it would nest the engine inside it. Otherwise copy it there, so installs never touch the plugin cache:

```bash
cp -R <plugin>/engine ./oncue-engine && cd oncue-engine && npm install
```

Run every command below from `oncue-engine`. Confirm the install on the bundled example:

```bash
npm run example:check
```

It prints the Gleaner example's beats and ends with `OK.` The storyboard and the deck are now ready.

## 4. Playwright with Chromium

Stills and video drive headless Chromium; the deck does not. If `node -p "require('playwright/package.json').version"` prints 1.40.0 or later, Playwright is already installed (many sandboxes preinstall it matched to their browser): use it and install nothing. The engine needs at least 1.40.0. Otherwise, missing or older:

```bash
npm install --save-dev playwright && npx playwright install chromium
```

Keep `--save-dev`. Playwright is an optional peer dependency of the engine, and npm 12 skips optional peers even when named: plain `npm install playwright` reports "up to date" and installs nothing. Saving it also keeps it in place when a later `npm install` adds a font; an unsaved install would be removed. This changes only the copy's `package.json`.

Prove it renders:

```bash
node dist/cli.js stills examples/gleaner/short.json
```

This writes silent preview frames to `examples/gleaner/build/stills/`. Open one: it should show a styled card on a dark ground, not a blank frame. A missing browser executable means Chromium was not installed: run `npx playwright install chromium` and try again.

When ffprobe is present, also run `npm run example:stills`, which times the frames to the example's voiceover through ffprobe. Do not render the example video here; it takes minutes, and the stills exercise the same chain.

## 5. ElevenLabs

The voiceover skill uses the ElevenLabs connector's `creative_*` tools (`creative_list_voices`, `creative_generate_speech`, `creative_transcribe_audio`). Check whether they are in this session; do not call them.

When they are missing, tell the person how to connect it. Their MCP configuration is theirs to change, so run a command only if they ask you to:

- **Claude Code:** `claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp`, then `/mcp` in a session to sign in with their ElevenLabs account (OAuth, no API key).
- **Claude app:** add a custom connector with the same URL.
- **Without ElevenLabs:** they can record or generate the narration themselves and attach the MP3, with a `words.json` of word timings in the shape the voiceover skill writes (`../voiceover/SKILL.md`, step 4).

Mention the cost: generation spends their ElevenLabs credits, about 1,100 a take for a 75-second script (two takes by default) and about 600 a transcription.

In a sandboxed session (claude.ai or a cloud environment), the audio downloads come from `storage.googleapis.com`. Tell the person to allow that domain under claude.ai Settings → Capabilities before the voiceover stage.

## 6. Report

A short table of each check (Node, ffmpeg and ffprobe, engine, Playwright with Chromium, ElevenLabs), ready or missing, with the fix for each one missing. Then say what works now:

| Output | Needs |
| --- | --- |
| Storyboard, deck | Node and the engine |
| Preview stills | and Playwright with Chromium |
| Silent preview video | and ffmpeg |
| Voiceover | ElevenLabs, or the person's own MP3 and `words.json` |
| Final video | all of the above, with ffprobe |

End with one next step: the fix that unlocks the most, or, when everything is ready, an example request such as "make an explainer short about our CLI" (explainer-video skill, `../explainer-video/SKILL.md`).
