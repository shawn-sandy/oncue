---
name: setup
description: Get OnCue ready to run. Report the installed plugin version and installation state and how to update it or install it for collaborators, check Node, ffmpeg and ffprobe, set up the engine with Playwright and Chromium, check the ElevenLabs connector, fix what can be fixed in the session, and report which outputs (storyboard, deck, stills, voiceover, video) will work. Use when the user has just installed the plugin, asks to set up, check, update or share OnCue, asks what they need to make a Short or a widescreen landscape 16:9 YouTube video, or a stage failed because Playwright, ffmpeg or ElevenLabs is missing.
compatibility: 'A shell for runtime checks and a writable workspace. Node.js 22+ for the bundled engine; Playwright Chromium for stills/video; ffmpeg for video; ffprobe for audio timing. External accounts are optional.'
---

# Setup

Check the plugin and the capabilities of this session, fix what can be fixed, and report each output separately. Never generate or transcribe during setup: those actions spend credits. Keep going after a missing capability so the report covers everything at once.

## Host and paths

Use the product running this conversation: Claude Code, the Claude app, Codex, or ChatGPT. Do not infer it from a CLI on PATH; the same machine may have several. Distinguish local execution from a cloud container. If the host is unclear, report it as unknown and run only the available capability checks.

`<plugin>` below is the absolute folder two levels above this skill's folder, holding `skills/` and `engine/`. Resolve it from the loaded skill location, not the working directory. Confirm the sibling engine and reference files exist. If the host mounts skills without `engine/`, report rendering blocked by missing bundled files; text research and a beat table can still work.

## 1. Plugin version, install and update

Read the loaded version from `<plugin>/.claude-plugin/plugin.json`, or `<plugin>/.codex-plugin/plugin.json` when the host converted the package. Use host-provided version metadata when files are unavailable. Report unavailable metadata and continue; do not infer a version from the engine's package.json.

Give the branch below for the current host. Change installation, account or persistent configuration only when the person has asked for that change. If they asked only to update or install for collaborators, stop after this step and report the result.

### Claude Code

Run `claude plugin list --json`. Entries with `id: "oncue@oncue"` report scope and version on disk. The applicable entries are the user entry and entries whose `projectPath` matches this working directory or its repository; local overrides project, which overrides user. With no matching entry, report scope unknown; use `--plugin-dir` installation advice only when session information confirms a clone load.

- Install: `claude plugin marketplace add shawn-sandy/oncue`, then `claude plugin install oncue@oncue`.
- Update: `claude plugin update oncue@oncue`, or choose **Update now** on the Installed tab of `/plugin`. Marketplace auto-update is optional: select `oncue` on the Marketplaces tab and choose **Enable auto-update**. Run `/reload-plugins` or start a new session to load the update.
- Collaborators: `claude plugin install oncue@oncue --scope project` records the repository setting. Each collaborator installs once with `claude plugin install oncue --marketplace shawn-sandy/oncue --scope project` (2.1.292+); older versions first add the marketplace.
- A confirmed clone load updates with `git pull` in that clone. Preserve local changes.

### Codex

Run `codex plugin list --json` and inspect the installed `oncue@oncue` entry. Report its version and enabled state; do not assign Claude installation scopes to it.

- Install: `codex plugin marketplace add shawn-sandy/oncue`, then `codex plugin add oncue@oncue`.
- Update a Git marketplace: `codex plugin marketplace upgrade oncue`. This refreshes the installed copy too; confirm the new version with `codex plugin list --json`. Start a new session to load it. For a marketplace added as a local folder, update that source folder and run `codex plugin add oncue@oncue` to refresh the installed copy.
- Do not run login or change the person's configuration merely to report setup. A missing CLI limits installation checks, not engine capability checks.

### ChatGPT

Report the loaded version and the session's actual execution capabilities. A workspace administrator imports the repository URL `https://github.com/shawn-sandy/oncue` through **Admin → Plugins → Add → Import marketplace**, leaving Path empty. They can select a branch, tag or commit to test a candidate. Marketplaces sync daily; **Sync now** requests a refresh. Read the import report, then start a new session and confirm the loaded version before testing the update. Import does not connect external accounts or grant access to apps.

ChatGPT workspace import and rendering have not been verified for this release. Check the current session rather than promising Node, package installation, a browser or a particular network policy. Never give another product's CLI or settings as a ChatGPT fix.

### Claude app or unknown host

Report the loaded metadata and available capabilities. Use this host's actual plugin management UI; do not assume a CLI installation or scope.

## 2. Node.js

Run `node --version` when shell execution is available. Engine operations need Node 22+. Without it, skip engine installation and rendering checks, continue the other available checks and report text research/storyboard as available. A file draft or beat table does not require Node.

On a local machine, suggest Node 22+ from nodejs.org or the person's version manager. In a managed container, report its observed version and limitations rather than instructing the person to change their local Node installation.

## 3. ffmpeg and ffprobe

Run `ffmpeg -version` and `ffprobe -version` separately and inspect each exit code. Do not use a combined `command -v ffmpeg ffprobe`: it can hide one missing binary.

Video encoding needs ffmpeg. Voice-timed stills and video also need ffprobe; the deck and estimated preview stills need neither. On a local machine, a single ffmpeg package usually supplies both (`brew install ffmpeg` or `sudo apt install ffmpeg`). Ask before installing system software; the person runs sudo themselves. In a managed container, report what is present and use only an available, permitted installation route. Do not assume npm metadata proves that a binary can install or run.

## 4. Engine in a writable workspace

Never install into the plugin cache. If `oncue-engine/` exists in the working folder, compare it against the loaded engine:

```bash
diff -rq <plugin>/engine/dist oncue-engine/dist
```

Exit 0 means reuse it with `npm install` from that copy. Exit 1 means the copies differ: rename the old folder to an unused name such as `oncue-engine.old`, copy afresh, and preserve the old copy until the new one works. An error reading either folder is not evidence of an old version; report it and fix the path. Never copy into an existing folder, which nests one engine inside another. Reinstall any extra `@fontsource/*` packages from the old copy when needed.

For a fresh copy:

```bash
cp -R <plugin>/engine ./oncue-engine
```

Run `npm install` from `oncue-engine`, then `npm run example:check`. Only an observed successful installation and the example's `OK.` establish engine readiness. An npm registry metadata lookup alone does not test native packages such as sharp. When installation fails, report the actual error and which operations it blocks; keep text planning available.

Run subsequent engine commands from this writable copy. The engine is bundled and precompiled; no TypeScript build is needed for normal use.

## 5. Playwright and Chromium

Stills, video and diagram PNGs need the Playwright package plus a browser it can launch. The deck does not. Check `node -p "require('playwright/package.json').version"` from the engine copy: reuse 1.40.0+ when available. Otherwise run `npm install --save-dev playwright` in that copy if network installation is permitted. Saving it keeps the optional peer installed during later font installs; do not change the cached plugin.

Try the default browser. Where downloads are permitted, `npx playwright install chromium` installs Playwright's matched browser. Where a usable Chromium is already installed outside that cache, set its verified absolute executable path:

```bash
export ONCUE_CHROMIUM_PATH="/absolute/path/to/chromium"
```

Do not guess this path, reuse another product's observation, or confuse it with `PLAYWRIGHT_BROWSERS_PATH`, which selects a download cache. The override still needs Playwright and a compatible browser. A bad override must fail visibly; unset it to return to Playwright's default. Keep any export session-local unless the person asks to persist it.

Prove the actual selection renders:

```bash
node dist/cli.js stills examples/gleaner/short.json
```

Open a frame from `examples/gleaner/build/stills/`: it must show the styled scene, not a blank page. With ffprobe, also run `npm run example:stills` for voice-timed frames. Record browser-launch or sandbox permission failures as unverified rendering; an installed package alone is not ready. Do not render the full example video during setup.

## 6. ElevenLabs and downloads

Discover the available tools and read their schemas. The voiceover workflow expects the `creative_*` flow, including create-flow, list-voices, generate-speech, status, attach-reference and transcription tools. Never call a generation/transcription tool during setup, invent a tool, or silently choose another provider.

Use the connection instructions for this host only, and change account configuration only when requested:

- **Claude Code:** `claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp`, then `/mcp` to sign in.
- **Claude app:** add a custom connector with that URL where the product supports it.
- **Codex:** `codex mcp add elevenlabs --url https://api.elevenlabs.io/v1/mcp`, then `codex mcp login elevenlabs` when the person asks to connect. Confirm with `codex mcp list`; signing in is a separate account action.
- **ChatGPT:** discover an allowed ElevenLabs plugin/connection in this workspace. If none exposes the documented tools, report generated voiceover unavailable; do not substitute a Claude configuration command.

Without the connector, accept a supplied MP3 plus matching `words.json` (voiceover skill, `../voiceover/SKILL.md`, step 4). An MP3 alone still needs a supported word-timestamp transcription route. Generation spends credits: the existing reference read cost about 1,100 credits per 75-second take and about 600 per transcription; actual charges can vary. Do not spend credits to check setup.

Audio links can use `storage.googleapis.com`. If a download is denied, honor that denial and report it:

- **Claude sandbox:** where the setting exists, allow the domain under claude.ai Settings → Capabilities, or supply attachments.
- **Codex:** use this session's actual network permissions and approval mechanism. Do not assume a global allowlist command or change persistent settings.
- **ChatGPT:** inspect the tools and network options actually offered in this session. Do not claim it has or lacks an allowlist. Ask for the MP3 and matching transcript as attachments when direct download is unavailable.

## 7. Report

Give a short table of the host/execution surface, loaded plugin version and installation state, Node, engine install/example check, Playwright/browser render, ffmpeg, ffprobe and ElevenLabs. Mark each **ready**, **missing**, **blocked** or **not tested** from observed evidence. Name any engine copy replaced or update waiting for a new session. Then report outputs independently:

| Output | Needs |
| --- | --- |
| Research and text storyboard | Supplied material; search for outside claims; write access only to save files |
| Spec checks and script | Node 22+, installed engine dependencies and readable spec/assets |
| Deck | Spec-check requirements plus a writable output folder |
| Preview stills and diagram PNGs | Engine, Playwright package and a successful Chromium launch |
| Silent preview video | Stills requirements plus ffmpeg |
| Generated voiceover | Connected supported ElevenLabs tools and generation authorization |
| Supplied voiceover | MP3 and matching word timestamps; transcription tools if timestamps are absent |
| Voice-timed stills | Stills requirements, matching audio/timestamps and ffprobe |
| Final video with audio | Video requirements, matching audio/timestamps and ffprobe |

End with the fix that unlocks the most, or a request such as “make an explainer short about our CLI” (explainer-video skill, `../explainer-video/SKILL.md`). Never claim an output works because a different host's check passed.
