# OnCue

**Explainer Shorts where every word lands on cue.**

Give Claude a topic and get a finished vertical explainer: storyboarded beats, an ElevenLabs voiceover, a native 9:16 PowerPoint deck, and an animated 1080×1920 MP4 where every card, step and tile appears on the exact word that names it. Ready for YouTube Shorts, Reels and TikTok.

One file, `short.json`, drives the storyboard, the voiceover script, the deck and the video, so they always match.

## Install

In Claude Code:

```text
/plugin marketplace add shawn-sandy/oncue
/plugin install oncue@oncue
```

To try it locally from a clone, run `claude --plugin-dir ./plugins/oncue`.

## Skills

| Skill | Ask for | You get |
| --- | --- | --- |
| [explainer-video](plugins/oncue/skills/explainer-video/SKILL.md) | "make an explainer short about our CLI" | The whole pipeline, with check-ins at the beats and the voice |
| [storyboard](plugins/oncue/skills/storyboard/SKILL.md) | "storyboard a 60-second Short for this plugin" | `short.json`, a beat list, preview stills or a Design canvas |
| [voiceover](plugins/oncue/skills/voiceover/SKILL.md) | "voice it with ElevenLabs" | Two takes as MP3, each with a word-level transcript |
| [vertical-deck](plugins/oncue/skills/vertical-deck/SKILL.md) | "make the 9:16 slides" | An editable .pptx, voiceover in the speaker notes |
| [animate-short](plugins/oncue/skills/animate-short/SKILL.md) | "render it, and animate the slides" | The final MP4, or a silent preview before audio exists |

## How it works

1. **Storyboard.** Claude writes the beats into `short.json`: each beat's voiceover line, a scene (`hook`, `list`, `card`, `chat`, `steps`, `grid`, `media` or `cta`), and for each element the word it should enter on. See [the spec reference](plugins/oncue/skills/storyboard/references/spec.md).
2. **Voiceover.** The ElevenLabs connector reads the whole script in one take for a consistent voice, then transcribes it with word timestamps.
3. **Deck.** The engine writes real PowerPoint text and shapes in your brand colours.
4. **Video.** Each scene is an HTML page stepped frame by frame in headless Chromium, with entrances on cue words, a typing effect, spotlight glows, drawn lines, scene transitions and a progress bar. ffmpeg encodes the frames and lays in the voice.

The worked example is Gleaner's own Short: [examples/gleaner/short.json](plugins/oncue/engine/examples/gleaner/short.json), with its voiceover and transcript beside it.

## Requirements

- Node.js 22 or newer, and `ffmpeg` and `ffprobe` on `PATH`.
- Playwright with Chromium for video and stills (`npm install playwright && npx playwright install chromium`); the deck alone does not need it.
- The ElevenLabs connector for the voiceover skill. Without it, attach your own MP3.
- In sandboxed sessions, allow `storage.googleapis.com` (claude.ai Settings → Capabilities) so Claude can download ElevenLabs audio.

## The engine

The typed engine lives in [plugins/oncue/engine](plugins/oncue/engine). The skills copy it into your working folder and run it there:

```bash
node dist/cli.js check  short.json                       # validate; print beats and estimated length
node dist/cli.js script short.json                       # the voiceover script
node dist/cli.js deck   short.json --out deck.pptx
node dist/cli.js stills short.json --words words.json --audio voiceover.mp3
node dist/cli.js video  short.json --words words.json --audio voiceover.mp3 --out short.mp4
```

Without `--words` and `--audio`, timing is estimated from the script and the video is a silent preview.

To work on the engine, run `npm install` and then `npm run build` in its folder. Sources are strict TypeScript in `src/`; the compiled `dist/` is committed so the skills run without a build step.

## Development

```bash
npm run validate          # manifests, skill frontmatter, links, shipped engine build, claude plugin validate
npm run engine:typecheck  # strict TypeScript check of the engine
```

The plugin version lives only in `plugins/oncue/.claude-plugin/plugin.json`.

## Changelog

### 1.0.0 (2026-10-25)

- First release: the explainer-video, storyboard, voiceover, vertical-deck and animate-short skills, the typed engine, and the Gleaner example.
