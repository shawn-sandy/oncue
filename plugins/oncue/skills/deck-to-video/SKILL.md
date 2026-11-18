---
name: deck-to-video
description: Turn a finished PowerPoint, Google Slides or Keynote deck into a narrated MP4 without changing the original file. Each slide is shown exactly as designed, narrated from its speaker notes or from a line drafted for it, and changes on the word that starts the next slide. Use when the user has a .pptx, an .odp or a PDF export and wants a video of it, such as "make a video from my deck", "narrate these slides", "turn this presentation into a video" or "add a voiceover to my Google Slides".
compatibility: 'Node.js 22+, the bundled engine, ffmpeg and ffprobe. Rendering slides needs LibreOffice (soffice) and poppler (pdftoppm), or slide images exported from the deck. Voiceover needs ElevenLabs creative tools or supplied audio with matching word timestamps.'
argument-hint: '[path to a .pptx, .odp or PDF export]'
---

# Deck to video

Make an MP4 from a deck somebody already built. This route does not use `short.json`: the slides are pictures of the person's own design, the narration is one line per slide, and ffmpeg joins them. Nothing is re-themed and nothing is animated.

Set up the engine as in `../explainer-video/SKILL.md`, and run the commands below from that writable engine copy. This route needs no browser.

## The original file is never changed

This is the rule the whole skill is judged on.

- Give `import` the path to the original and never open, save, move, rename or re-export that file yourself. `import` copies it into `<folder>/work/` and every tool reads the copy.
- `import` records the original's SHA-256 checksum and modified time in `<folder>/source-manifest.json` and fails if they moved. `narration` and `assemble` re-check it and stop if the file has changed since.
- The project folder must not be the deck's own folder; `import` refuses it. By default it is a new `<deck name>-video` folder beside the deck.
- A deck that lives in Google Drive is read-only to this skill. Ask the person to download it (File → Download → PowerPoint or PDF) and work from the download. Never call a tool that writes to their Drive or their presentation: `update_presentation`, `update_file`, `trash_file` and `share_file` are the ones to avoid, and so is any other tool that edits, moves, shares or deletes.
- Speaker notes are the person's words. Use them as written; never rewrite them to make a recording easier.

At the end, report the checksum line from `source-manifest.json` so the person can see it is unchanged.

## Say this up front

- **Formats.** A .pptx (from PowerPoint, Keynote's export, or Google Slides' download), an .odp, or a PDF export. A PDF is the most faithful picture of the slides but carries no speaker notes, so every line is drafted. A Google Slides download as .pptx is expected to keep its notes; check after import rather than promising it.
- **What is not carried over.** Slide animations, builds, transitions, video and audio on slides. Each slide is one still picture.
- **Fidelity.** LibreOffice draws the .pptx or .odp. It substitutes fonts that are not installed and can misdraw SmartArt and some charts. If the pictures look wrong, ask for a PDF export from the app that made the deck, or for the slides exported as images.
- **Shape.** The video keeps the deck's own shape, scaled to fit 1920×1080. A 16:9 deck fills it; a 4:3 deck comes out 1440×1080.
- **Hidden slides** are skipped.

## 1. Import

```bash
node dist/cli.js import <deck.pptx> --out <folder>
```

This writes `<folder>/pages/slide-NN.png`, `slides.json` (order, notes and text of each visible slide), `narration.md` and `source-manifest.json`.

If it stops because `soffice` or `pdftoppm` is missing, do not work around it by converting the original yourself. Report which one is missing and offer the two routes that work: installing it (the setup skill, `../setup/SKILL.md`, has the commands, and the person approves system installs), or slide images exported from the deck by the app that made it, passed as a folder with one image per visible slide in order:

```bash
node dist/cli.js import <deck.pptx> --out <folder> --pages <folder of slide images>
```

Look at every page picture before going on. Say plainly if any slide is drawn wrong.

## 2. Draft the narration

`narration.md` has one section per slide. Slides with speaker notes are filled in and marked `(notes)`. Slides without notes are marked `(none)`, with the slide's own text beside them as a hint.

For each `(none)` slide, look at its page picture and write one or two spoken sentences that say what the slide shows, using only what is on the slide or in the person's material. Put the line under the heading and change the marker to `(drafted)`. Leave a slide `(none)` only when the person wants it silent: it is then held for four seconds with no sound. For a PDF every slide starts as `(none)`.

Then run:

```bash
node dist/cli.js narration <folder>
```

It prints the script, the slides with no narration, an estimated length and a rough credit estimate, and writes `recording-plan.json`. Read its warnings:

- **A slide's first word is also heard inside an earlier slide.** The narration is recorded as one continuous read and split at each slide's first word, so that slide would start too early. If the line was drafted, reword its opening and run `narration` again. If it is the person's notes, leave them alone: the plan already records that slide as its own clip, and the slides around it stay in continuous takes. Each extra recording is another take to pay for; say how many there are.
- **A slide is marked `(notes)` but differs from the deck.** Restore the notes, or mark it `(drafted)` if the person asked for the change.

## 3. Get approval

Show the person `narration.md`, the page pictures and the estimate: how many recordings, about how long, and that generating and transcribing spends their credits. **Do not record anything yet.** When they approve, they (or you, on their say-so) change the first lines of `narration.md` to `approved: true`. Then:

```bash
node dist/cli.js narration <folder> --approved
```

This exits with an error until the file is approved. Only its output is the script to record.

A silent preview needs no approval and no credits: run step 5 before recording, and it writes `preview-silent.mp4` with estimated timing.

## 4. Record the voiceover

Use the voiceover skill (`../voiceover/SKILL.md`) with the script from step 3. `recording-plan.json` lists each recording in order with the file names to save: `voiceover-01.mp3` and `words-01.json` for the first, and so on. Most decks need exactly one. Use the same voice for every recording.

## 5. Assemble

```bash
node dist/cli.js assemble <folder>
```

This writes `<folder>/deck.mp4`: H.264 and AAC at 30 frames a second. Each slide appears on its first spoken word and the last holds for a moment after the narration ends. If a slide's first word is not found in its transcript, the command names the slide: the narrator probably changed that word, so re-transcribe or re-record that take, and do not edit the notes to match.

Grab a frame or two and check them against the page pictures before sending the video:

```bash
ffmpeg -ss 5 -i <folder>/deck.mp4 -frames:v 1 <folder>/check-5s.png
```

## 6. Deliver

Send the MP4 and say in a few lines: how many slides, which were narrated from notes and which from drafted lines, which voice, what it cost in credits, anything that was not verified (for example rendering fidelity on a slide), and that the original file is unchanged, with its checksum from `source-manifest.json`.
