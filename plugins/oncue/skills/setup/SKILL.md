---
name: setup
description: Get OnCue ready to run. Report the installed plugin version and scope and how to update it or install it for collaborators, check Node, ffmpeg and ffprobe, set up the engine with Playwright and Chromium, check the ElevenLabs connector, fix what can be fixed in the session, and report which outputs (storyboard, deck, stills, voiceover, video) will work. Use when the user has just installed the plugin, asks to set up, check, update or share OnCue, asks what they need to make a Short, or a stage failed because Playwright, ffmpeg or ElevenLabs is missing.
---

# Setup

Check the plugin and what OnCue needs on this machine and in this session, fix what you can, and say which outputs are ready. Nothing here spends ElevenLabs credits: never call a generation or transcription tool during setup.

Work through the checks in order and keep going past a failure, so the report covers everything at once.

Below, `<plugin>` is the absolute path of the folder two levels above this skill's folder, the one holding `engine/` and `skills/`.

## 1. The plugin

Read the version this session loaded from `<plugin>/.claude-plugin/plugin.json`. Where the `claude` CLI is on `PATH`, see how it was installed:

```bash
claude plugin list --json
```

An entry with the `id` `oncue@oncue` gives its `scope` (`user`, `project` or `local`) and the `version` on disk; a `project` or `local` entry names its folder in `projectPath`. A version on disk newer than the loaded one is an update waiting for `/reload-plugins` or a new session. With no `oncue@oncue` entry, OnCue was most likely loaded with `--plugin-dir` from a clone, which updates with `git pull` in that clone. Without the CLI, report the loaded version alone.

The person's Claude Code settings are theirs to change: give these commands, and run one only if they ask you to.

- **Update.** OnCue's marketplace does not auto-update by default. Run `claude plugin update oncue@oncue` in a shell, with `--scope` for a project or local install, or choose **Update now** for OnCue on the **Installed** tab of `/plugin`. To have it update itself, select the `oncue` marketplace on the **Marketplaces** tab of `/plugin` and choose **Enable auto-update**. The running session keeps the version it loaded, so after updating, run `/reload-plugins` or start a new session and set up again: the checks below then run against the new version, and step 4 replaces any engine copy made by the old one.
- **Install for collaborators.** `claude plugin install oncue@oncue --scope project` turns OnCue on in this repository's `.claude/settings.json`, which they commit. That does not download it for anyone else: each collaborator runs `claude plugin install oncue --marketplace shawn-sandy/oncue --scope project` once (Claude Code 2.1.292 or later; on older versions, `claude plugin marketplace add shawn-sandy/oncue` first, then `claude plugin install oncue@oncue --scope project`).

## 2. Node.js

```bash
node --version
```

Every stage needs 22 or newer. If it is older or missing, tell the person to install Node 22+ (nodejs.org or their version manager), skip steps 4 and 5, which need it, and still run steps 3 and 6 and the report.

## 3. ffmpeg and ffprobe

```bash
ffmpeg -version | head -1
ffprobe -version | head -1
```

Each must print a version line; `command not found` names the one that is missing. Check them separately: `command -v ffmpeg ffprobe` exits 0 in bash even when one is missing. The video needs ffmpeg, and anything timed to a real voiceover (stills or video with `--audio`) needs ffprobe. One package installs both: `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian or Ubuntu. Ask before installing; anything with `sudo` the person runs themselves. Without ffmpeg the storyboard, the deck and silent preview stills still work.

## 4. The engine

The engine is in this plugin's `engine/` folder (`../../engine` from this skill's folder).

If `oncue-engine/` already exists in the working directory, check that this version of the plugin made it:

```bash
diff -rq <plugin>/engine/dist oncue-engine/dist
```

No output means it did: reuse it with `cd oncue-engine && npm install`. Copying over it would nest the engine inside it. When `diff` lists files, an older OnCue made the copy and it still runs the old engine. Rename it with `mv oncue-engine oncue-engine.old` (pick another name if that one is taken: `mv` into an existing folder nests it), make a fresh copy as below, and tell the person they can delete the old one once the new one works. The fresh copy needs Playwright again (step 5), and any `@fontsource/*` package in the old copy's `package.json` but not the new one needs `npm install @fontsource/<name>`.

With no `oncue-engine/`, or after renaming an old one, copy the engine there, so installs never touch the plugin cache:

```bash
cp -R <plugin>/engine ./oncue-engine && cd oncue-engine && npm install
```

Run every command below from `oncue-engine`. Confirm the install on the bundled example:

```bash
npm run example:check
```

It prints the Gleaner example's beats and ends with `OK.` The storyboard and the deck are now ready.

## 5. Playwright with Chromium

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

## 6. ElevenLabs

The voiceover skill uses the ElevenLabs connector's `creative_*` tools (`creative_list_voices`, `creative_generate_speech`, `creative_transcribe_audio`). Check whether they are in this session; do not call them.

When they are missing, tell the person how to connect it. Their MCP configuration is theirs to change, so run a command only if they ask you to:

- **Claude Code:** `claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp`, then `/mcp` in a session to sign in with their ElevenLabs account (OAuth, no API key).
- **Claude app:** add a custom connector with the same URL.
- **Without ElevenLabs:** they can record or generate the narration themselves and attach the MP3, with a `words.json` of word timings in the shape the voiceover skill writes (`../voiceover/SKILL.md`, step 4).

Mention the cost: generation spends their ElevenLabs credits, about 1,100 a take for a 75-second script (two takes by default) and about 600 a transcription.

In a sandboxed session (claude.ai or a cloud environment), the audio downloads come from `storage.googleapis.com`. Tell the person to allow that domain under claude.ai Settings → Capabilities before the voiceover stage.

## 7. Report

A short table of each check (the plugin's version and scope, Node, ffmpeg and ffprobe, engine, Playwright with Chromium, ElevenLabs), ready or missing, with the fix for each one missing. Flag an update waiting to load, or an engine copy replaced in step 4. Then say what works now:

| Output | Needs |
| --- | --- |
| Storyboard, deck | Node and the engine |
| Preview stills | and Playwright with Chromium |
| Silent preview video | and ffmpeg |
| Voiceover | ElevenLabs, or the person's own MP3 and `words.json` |
| Final video | all of the above, with ffprobe |

End with one next step: the fix that unlocks the most, or, when everything is ready, an example request such as "make an explainer short about our CLI" (explainer-video skill, `../explainer-video/SKILL.md`).
