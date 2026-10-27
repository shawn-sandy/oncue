---
name: vertical-deck
description: Build a native, editable PowerPoint deck from a short.json explainer, vertical 9:16 or widescreen landscape 16:9, one slide per beat with the voiceover in the speaker notes, ready to present or record into a YouTube Short or a YouTube video. Use when the user wants a vertical, portrait or 9:16 presentation, a widescreen or 16:9 deck, a deck for Shorts, Reels, TikTok or YouTube, or "the slides" for an explainer they storyboarded.
argument-hint: '[path to short.json]'
---

# Vertical or widescreen deck

Write `deck.pptx` from `short.json`: 5.625 × 10 inches (exports as 1080×1920) for a portrait or square spec, 10 × 5.625 inches (exports as 1920×1080) for a landscape one, the brand's colours, real text boxes and shapes the person can edit, icons as images, and each beat's voiceover in the speaker notes so PowerPoint or Keynote can record narration over it.

## When this is the right output

- The person wants a .pptx (to edit, present, or record in PowerPoint or Keynote), or an editable companion to the video.
- The deck is drawn for 9:16 and 16:9 only. The spec's orientation picks one: landscape (wider than tall) gets the 16:9 deck, portrait and square (1080×1350, 1080×1080) the 9:16 deck. When the spec's aspect differs from the deck's, `deck` prints a one-line note saying so; the video keeps the exact size.
- In 16:9, each slide follows the same arrangement as the video: lists, cards, chats and steps put the kicker and title beside the body, grids and media put them above it, and the hook and call to action stay centred.
- No spec yet? Run the storyboard skill (`../storyboard/SKILL.md`) first. A deck needs only `short.json` and the logo, not the voiceover.

## Build

From the engine folder (set up as in `../explainer-video/SKILL.md`):

```bash
node dist/cli.js deck <folder>/short.json --out <folder>/deck.pptx
```

Fonts written into the deck are `brand.deckFonts`; PowerPoint renders them on the viewer's machine, so keep them to fonts that ship with Office (Arial, Calibri, Cambria). `deckFonts.mono` (default Courier New) sets kickers, code, tags and timestamps. The deck follows `theme` too: corners, point sizes, gaps and the brand row; `background` is video only.

## Check

When the pptx skill is available, use its scripts to validate the file and render it to images (`office/validate.py`, then `soffice.py --convert-to pdf` and `pdftoppm`), and look at every slide. Without them, open the PDF export or rebuild the stills from the video skill, which share the same layout.

Look for text running past its box (titles over about 45 characters, a `desc` over two lines), content in the bottom 1.4 inches of a portrait deck (covered by Shorts captions and buttons), and low contrast. Fix the copy in `short.json` and rebuild; never patch the .pptx by hand, or the deck and the video drift apart.

## Deliver

Send the file with a one-line note. Speaker notes are not narration: to turn the deck into a voiced video, the person first records the slideshow while reading the notes (Record in PowerPoint, Play → Record Slideshow in Keynote), then exports it (File → Export → Create a Video in PowerPoint, or File → Export To → Movie in Keynote, custom 1080×1920, or 1920×1080 for a 16:9 deck). The animate-short skill (`../animate-short/SKILL.md`) makes an animated, voiced MP4 directly from the voiceover files.
