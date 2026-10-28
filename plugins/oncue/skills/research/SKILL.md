---
name: research
description: Research the subject of an OnCue explainer at any stage, from a bare topic to a rendered video. Suggest ranked topics for Shorts or YouTube videos, gather sourced facts, fact-check or source a storyboard, rewrite the narration with sources, and recommend icons and pictures per beat, all written to research.md beside short.json. Use when the user wants to research a topic for a Short, suggest Short or video topics, fact-check, source or verify the storyboard or script, make the narration punchier, tighter or clearer, or recommend visuals. It reads the project folder to find the stage, so recorded narration never changes without asking.
argument-hint: '[topic, or path to short.json]'
---

# Research

One skill owns the facts, the topic ideas and narration rewrites, so the `vo` lines have one editor besides the storyboard skill. It can join at any stage: the project folder says what may change, and everything it finds goes into `research.md`, which Claude reads and the engine never does.

## 1. Find the stage

The project folder is the one holding `short.json`; with none, the working folder. List it (and `build/`) before anything else, take the last row whose files are present, and say the stage in your first line.

| In the folder | Stage | You may change |
| --- | --- | --- |
| No `short.json` | Idea | Anything. Write `research.md`; there is no narration yet. |
| `short.json` | Storyboard | `vo` lines, scenes and icons, each on the person's approval. |
| Any `voiceover*.mp3` or `words*.json`, unchosen takes such as `voiceover-take1.mp3` or `words-take1.json` included | Voiced | On-screen text and icons only. Changing any `vo` means recording again: about 1,100 ElevenLabs credits a take, two takes by default, plus about 600 to transcribe. Say that, with the cost, and ask before changing any `vo`; change it only if the person accepts the re-record. |
| `short.mp4`, or `build/short.mp4` (where the engine writes it without `--out`) | Rendered | As Voiced, and any change means rendering the video again, which takes minutes and longer on slower machines. |

An unchosen take locks `vo` too: the transcript is of that audio, so a changed line no longer matches it. When a request needs a locked change, still do the research, show the proposed line as a proposal, and ask.

## 2. Gather sources

- In this order: the person's own files (README, docs, code, notes, an existing `research.md` and `short.json`), then official pages (product site, docs, changelog, release notes), then reputable secondary sources. Use WebSearch and WebFetch when the session has them; without them, work from the files and say what you could not check.
- Never invent a number, quote, date, name or result. Mark a missing fact `[YOUR FACT]` and list it under Open questions.
- Keep every fact with its source: a URL, or a file path and section heading. Copy numbers and quotes exactly.

## 3. Write research.md

Write it beside `short.json`, or in the working folder before one exists. When it exists, update it: keep earlier sections and add to them.

```markdown
# Research: <subject>

## Angle and audience
<the one thing a viewer should take away, and who they are>

## Key facts
- <fact>. Source: <URL, or file path and section>

## Numbers and quotes
- "<exact quote or number>" — <source>

## Topic ideas
1. **<angle>**
   - Hook: "<a line that could be beat 1's vo>"
   - Audience: <who it is for>
   - Why this rank: <what the viewer gets, how well sourced, how visual>
   - Sources: <README section, URL>

## Visual ideas
| Beat | Icons (Feather) | Picture | Source and license |
| --- | --- | --- | --- |

## Open questions
- [YOUR FACT] <what is missing> (resolved: <answer and source>, once known)

## Credits
- <picture, author, license, link>; flag any license you could not confirm: "check before publishing"

## Sources
- <every URL and file used>
```

Leave out a section with nothing in it, except Sources.

## 4. Suggest topics

Give 3 to 5 angles, ranked, in `research.md` and in the reply. Each has a hook line usable as beat 1's `vo` (one sentence that starts with a plain word), an audience, and its sources; for a product, name the README or docs section each angle comes from. Rank by what the viewer gets, then how well the facts are sourced, then how much there is to show. Ask the person to pick one, then hand it to the storyboard skill (`../storyboard/SKILL.md`).

## 5. Fact-check a storyboard

Read every beat's `vo` and on-screen text. Mark each claim verified (with its source), wrong (with the correction and its source) or unverified (`[YOUR FACT]`), and put the result in `research.md` and in the reply as a short table. On-screen corrections are safe at every stage once the person approves. A `vo` correction follows the stage table.

## 6. Rewrite narration

For each beat you would change, show the current line, the proposed line and the source behind any fact in it. The proposed line must:

- Start a new sentence with a plain word, not a number or symbol: the engine finds each line in the transcript by its first word, so it has to survive transcription.
- Keep every cue word of that beat (the `word` of each `cue`, `headlineCue` and so on), or change that cue to a word in the new line and say which.
- Stay one or two sentences, written for the ear, with every fact sourced.

Apply a rewrite only when the person approves it, and only at the Storyboard stage, or later if they accepted the re-record and its cost. Then edit `vo` and any changed cues in `short.json` and run `node dist/cli.js check <folder>/short.json` from the engine folder (set up as in the explainer-video skill, `../explainer-video/SKILL.md`); fix any cue warning it prints. If the engine is not set up, say that `check` was not run.

## 7. Recommend visuals

Per beat, suggest Feather icon names from `react-icons/fi` (`FiLayers`, `FiSearch`, `FiClock`, and so on) and, where a real picture would show the idea better, a picture: the person's own screenshot, a drawn diagram, or an openly licensed image with its source and license. Visuals change only `scene`, so they are safe at every stage. The visuals skill (`../visuals/SKILL.md`) sources, makes and places the pictures from this table.

## 8. Hand off

| Stage | Next |
| --- | --- |
| Idea | Storyboard the chosen topic (`../storyboard/SKILL.md`). |
| Storyboard | Lock the beats in the storyboard skill, then record (`../voiceover/SKILL.md`). |
| Voiced | Rebuild the deck (`../vertical-deck/SKILL.md`) or the video (`../animate-short/SKILL.md`) after on-screen changes; record again (`../voiceover/SKILL.md`) only after the person accepted a `vo` change and its cost. |
| Rendered | Render again (`../animate-short/SKILL.md`) after any change. |

End with what changed in `research.md` and `short.json`, the `[YOUR FACT]` items still open, and one next step.
