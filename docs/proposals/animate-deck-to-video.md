---
status: proposal
type: feature
created: 2026-11-18
repo-name: oncue
---

# Proposal: Animate the deck-to-video route with build states and cross-fades

> This is a proposal for review, not an execution plan. It is grounded in a read of `engine/src/assemble.ts`, `slides.ts`, `timeline.ts`, `cues.ts` and `narration.ts`, and in seven experiments run on this machine on 2026-11-18 (LibreOffice 26.8.3.1, poppler 26.11.0, ffmpeg 9.0.2, Playwright 1.65.1). Every number below comes from those runs; their output is in Appendix A. No engine code was written.

## TL;DR

- A `.pptx` stores everything needed to rebuild the order of a slide's builds: which shape or paragraph enters on which click, the effect, its duration and any delay. It stores the slide transition too. None of it is rendered pixels; it is instructions for a player.
- Nothing installed here exports video or per-build pictures from a deck. LibreOffice's PDF export flattens every build into the finished slide and it has no video filter.
- Two things do work. Rendering each build state as its own still (hide what has not entered yet in a copy, render through the existing LibreOffice and pdftoppm path) gave pixel-stable states in 4.3 s for a 3-slide deck. And ffmpeg's `xfade` between two consecutive states looks like the new element fading or wiping in, because every other pixel is identical.
- Builds line up with narration the way `short.json` cues do: the first word of the built text that the narrator says in that slide's line. All 5 click steps in the test deck matched a spoken word with no hand-written cues.
- Recommended first step: cross-fades between slides only. It needs no deck parsing, changes one function, and cost 2 s extra on a 150 s encode. Builds are the second step. Reproducing PowerPoint's motion (fly-ins, motion paths, emphasis, exits) is below the cut line.

## Context

`deck-to-video` turns a finished deck into an MP4 in three commands. `import` renders one PNG per visible slide (`renderPages` in `slides.ts`: `soffice --convert-to pdf`, then `pdftoppm -r 150`). `narration` builds a script from speaker notes behind an approval gate. `assemble` gives each slide one looped still, trims it to the slide's span and joins the stills with the ffmpeg `concat` filter, so every slide change is a hard cut.

The cut times come from `buildSlideTimeline` (`timeline.ts`), which finds each slide's first spoken word in the transcript and cuts midway through the pause before it. The sibling test session measured those cuts within one frame of the first word on a real 13-slide deck.

The skill tells the person that animations, builds and transitions are not carried over (`skills/deck-to-video/SKILL.md`). A slide that reveals five bullets one click at a time appears with all five on screen from its first frame, while the narrator is still on the first.

The other route already solves the timing half of this. `buildTimeline` matches each animated slot's cue word against the words heard in its line, and spreads slots evenly across the line when no cue is found.

## Core finding

> The deck stores the order of builds, not pictures of them, and nothing here plays that order to video. But a build is only a difference between two stills, and the engine already knows how to place a picture change on a spoken word. Rendering one still per build state and joining states with `xfade` covers entrances, which is what builds mostly are, without a slideshow player.

## What a .pptx stores

A slide part (`ppt/slides/slideN.xml`) can carry two optional elements after `<p:clrMapOvr>`.

**`<p:transition>`** is how this slide arrives. Attributes: `spd` (`slow`, `med`, `fast`), `advClick`, and `advTm` (auto-advance after that many milliseconds). One child names the effect and its direction, for example `<p:fade/>`, `<p:push dir="l"/>`, `<p:wipe dir="r"/>`.

**`<p:timing>`** holds a time-node tree and a build list:

```xml
<p:timing><p:tnLst><p:par><p:cTn nodeType="tmRoot">
  <p:seq><p:cTn nodeType="mainSeq"><p:childTnLst>
    <p:par>                                  <!-- one click step -->
      <p:cTn><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>   <!-- waits for a click -->
        ...
        <p:cTn presetID="10" presetClass="entr" nodeType="clickEffect">   <!-- Fade entrance -->
          <p:stCondLst><p:cond delay="0"/></p:stCondLst>
          <p:set> ... <p:tgtEl><p:spTgt spid="4"/></p:tgtEl> style.visibility -> visible </p:set>
          <p:animEffect transition="in" filter="fade"><p:cTn dur="500"/> ... </p:animEffect>
```

What can be read from it:

| Information | Where it is |
|---|---|
| Order of steps | Document order of the children of the `mainSeq` node |
| What starts a step | `nodeType`: `clickEffect` opens a new click step, `withEffect` and `afterEffect` join the current one |
| What is animated | `<p:spTgt spid="N"/>`, the shape's `<p:cNvPr id>`; a paragraph adds `<p:txEl><p:pRg st="k" end="k"/>` |
| Kind of effect | `presetClass` (`entr`, `exit`, `emph`, `path`), `presetID` (1 Appear, 10 Fade, 22 Wipe) and `presetSubtype` (direction) |
| How it moves | Behaviour children: `<p:set>` (visibility), `<p:animEffect filter="fade">`, `<p:anim>` (property curves), `<p:animMotion>` (paths) |
| Timing | `dur` in milliseconds on the behaviour's `<p:cTn>`; `<p:cond delay="750"/>` for an offset after the previous effect |
| By-paragraph builds | `<p:bldLst><p:bldP spid="N" build="p"/>` |

What is not there: any rendered frame, and any time for a click. A click step waits for the presenter, so when a build happens is the narration's decision, which is the part OnCue is good at.

Evidence and its limit. The fixture deck from `make-deck.mjs` and the one real deck on this machine (`prompt-triage-promo-deck.pptx`, 13 slides, PowerPoint 16) contain no `<p:timing>` or `<p:transition>` at all (experiments 1 and 2). So the test deck here was built with pptxgenjs and the XML above was written by hand to the schema: three transitions, five click steps, shape targets, paragraph targets and one `afterEffect` with a 750 ms delay. LibreOffice read all of it into its own model (`ooo-entrance-appear`, `ooo-entrance-fade-in`, `ooo-entrance-wipe`, five `on-click`, one `after-previous` beginning at `0.75s`), which shows the XML is well-formed and means what it should (experiment 3). It is not a file PowerPoint itself wrote. A real deck with builds is still needed before step 2 is built; see Resolved decisions.

## What can be rendered faithfully

| Approach | Result here | Fidelity |
|---|---|---|
| LibreOffice PDF (today) | 3 slides gave 3 pages, every shape and bullet present | Finished slide only. Builds flattened, transitions gone |
| LibreOffice video export | No such filter. The Impress export filters are bmp, emf, eps, gif, html, jpg, pdf, png, svg, tif, webp, wmf | Not available |
| PDF export with builds | The PDF options include `ExportHiddenSlides`, `ExportNotesPages` and `UseTransitionEffects`; none exports build steps | Not available |
| Build states through LibreOffice | Works. 8 stills for 3 slides in 4.3 s, layout stable between states | Exact slide rendering at each click. No motion between states |
| LibreOffice SVG export in Chromium, stepped | Works for states. One file holds all slides, the animations and a JavaScript player; ArrowRight stepped every click correctly | States correct, but text is drawn in a different font from the PDF path and the bullets of hidden paragraphs stay visible |
| Same SVG player, real motion captured | Failed. With Playwright's clock faked, the first `clock.runFor(1000)` after load never returned (stopped after 18 s, and after several minutes in an earlier run) | Unknown. Would need work on the player's timer loop |
| PowerPoint or Keynote export | Neither is installed here | Untested. Would be the true reference, but cannot be a dependency |

**Build states** are the useful one. For state k of a slide, take the copy `import` already works on, remove each shape whose entrance is in a later step, and for a paragraph entrance leave the paragraph in place but give its runs a fully transparent fill, so the text box keeps its size and nothing reflows. Render as today. In the experiment the hidden paragraphs' bullets disappeared with their text, and already-visible text did not move between states (experiment 5).

The experiment wrote one deck copy per state number, so it ran LibreOffice four times for a deck whose busiest slide has three steps. A build would instead write one copy with each slide repeated once per state and convert once.

**The SVG player** is the only thing found that knows how to play a deck's animations, and it is a real find: 22 `anim:par` and 8 `anim:transitionFilter` elements survived into the SVG. But it is a second renderer with different fonts, it draws from timers, and the engine's rule is that animation is a pure function of time. It is not worth pursuing unless true motion becomes a requirement.

## How it lines up with narration

`assemble` already has, per slide, the span of the recording it occupies and the words heard in that span. A build step needs one more time inside the span.

1. **Read the steps at import.** Write them into `slides.json` beside each slide: for each step, the text of what enters and the effect.
2. **Find a cue word.** For each step in order, take the words of its text of four letters or more and find the first one the narrator says in this slide's line, after the previous step's cue. This is `buildTimeline`'s matching (`norm`, `startsWith`) pointed at the built text instead of a hand-written cue.
3. **Fall back to even spacing.** A step with no word heard is spread across the span, as `buildTimeline` does for a slot with no cue, with the same kind of warning.
4. **Keep the deck's own offsets.** An `afterEffect` keeps its delay relative to the step it follows.
5. **Let the person override.** `narration.md` is already the file they approve. A step could be named there with a cue word when the automatic match is wrong. This is a contract change and belongs in the plan, not here.

In the experiment all five steps matched (experiment 6):

```
slide 2 step 1 "Alpha arrives first": on the word "alpha." at 4.28s
slide 2 step 2 "Bravo fades in": on the word "bravo" at 5.39s
slide 2 step 3 "Charlie wipes in": on the word "charlie" at 7.31s
slide 3 step 1 "Delta point": on the word "Delta" at 9.41s
slide 3 step 2 "Echo point": on the word "Echo" at 11.46s
```

That deck's notes were written to mention each bullet, so this is the best case. The sibling session found that real speaker notes are often presenter reminders, not a script; on such a deck more steps will fall back to even spacing. The match rate on real notes is unmeasured.

One collision showed up. Slide 3's line opens with its first bullet's word ("Delta is the first point"), so the build began at 9.41 s while the slide's own 0.5 s transition, centred on the cut at 9.18 s, was still running until 9.43 s. A build must not start before its slide's transition has finished.

## Simple wins in ffmpeg

`xfade` replaces `concat` in the video half of `assemble`. Each still is held a little longer so the change can overlap, and each `xfade` gets an offset on the output timeline. Total length is unchanged, so the soundtrack half is untouched.

Measured on the 3-slide deck, silent preview with estimated timing (experiment 6):

| Variant | Stills | Length | Encode | Hard cuts ffmpeg detects |
|---|---|---|---|---|
| Today: finished slides, hard cuts | 3 | 16.27 s | 0.5 s | 2 (3.27 s, 9.17 s) |
| Cross-fades between slides | 3 | 16.27 s | 0.7 s | 0 |
| Build states on spoken words, plus transitions | 8 | 16.27 s | 0.8 s | 1 (4.27 s, the Appear, which is meant to be a cut) |

At the length of the real deck the sibling session tested (13 stills, 150 s), hard cuts encoded in 3.82 s and twelve 0.5 s cross-fades in 5.79 s (experiment 7).

The finding that makes builds cheap: an `xfade` between state k and state k+1 of the same slide is a fade-in of the new element, because nothing else differs. Sampled inside the second box during its planned fade from 5.39 s to 5.89 s, the pixel went from white (255, 255, 255) through (134, 204, 149) at 5.64 s to the box's green (30, 160, 59) at 5.86 s. A `wiperight` did the same for a wipe from the left: at 7.56 s the left of the third box was blue and the right still white. With hard cuts the same pixel is already green at 3.40 s, two seconds before the narrator reaches it.

Mapping used: transition `fade` to `fade`, `push dir="l"` to `slideleft`, `wipe dir="r"` to `wiperight`; entrance Appear to a cut, Fade to `fade`, Wipe from left to `wiperight`. A whole-frame wipe reveals the element as the wipe line crosses it, not across the element's own width, so its timing is approximate.

Two details for the plan. `xfade` does not take a zero duration, so the experiment made a cut a one-frame fade; real code should `concat` runs of cuts and `xfade` only the real fades. And the slide cross-fade was centred on the existing cut time, so the new slide is half visible at the moment the engine cuts today and fully visible 0.25 s later. That is about when its first word starts: the cut sits midway through the pause, and the estimated pause between sentences is 0.45 s. A shorter fade, or one that ends on the cut, is a choice for the plan.

## Side-by-side

| Dimension | 1. Cross-fade slides (recommended first) | 2. Build states on cue words | 3. Play the deck's real motion |
|---|---|---|---|
| What changes | Video filter graph in `assemble.ts` | `import` parses `<p:timing>` and renders extra stills; `slides.json` gains steps; `assemble` places them | A slideshow player driven frame by frame, or a deck-to-HTML converter |
| Deck parsing | None | Entrances only, read in order | The whole animation model |
| Fidelity | Slides no longer snap. Deck's own transition kind ignored or roughly mapped | Right content on screen at the right word. Fade, wipe and appear look right; other entrances become a fade | Would match PowerPoint if it worked |
| Works for PDF input | Yes | No, a PDF has no builds | No |
| New dependency | None | None | Chromium for this route, which today needs no browser |
| Risk | Low: length and audio unchanged | Medium: regex parsing of nested XML, paragraph hiding, untested on PowerPoint-written decks | High: the only player found stalled under a controlled clock |
| Measured cost | About 2 s on a 150 s video | 4.3 s more rendering on 3 slides as prototyped; one conversion if done properly | Unknown |

## Recommendation and cut line

**First step: cross-fade between slides.** One default 0.5 s fade centred on the existing cut, in `assemble.ts` only, with an option to turn it off. It works for every input including PDF, cannot desynchronise the sound because the length does not change, and removes the hardest edge in today's output. Reading `<p:transition>` to pick the deck's own effect is optional polish on top and can wait.

**Second step: build states for entrances.** Parse click steps at import, render one still per state, place each on its cue word with even spacing as the fallback, and join with a fade (or a cut for Appear). This is where most of the value is: the screen stops showing what the narrator has not said yet.

**Below the cut line:**

- Exit and emphasis effects, motion paths, and any entrance's true motion (fly, zoom, bounce). They become a fade or are ignored, and the skill says so.
- Builds inside charts, SmartArt and grouped shapes.
- Trigger sequences (click on a shape) and slide auto-advance times (`advTm`).
- The SVG player and any browser on this route.
- Video and audio on slides, and morph transitions.
- `.odp` builds. LibreOffice's model is equivalent (`anim:par`, `presentation:node-type`), but it is a second parser; do it only if someone asks.

## Risks and tensions

- **The test XML is hand-written.** PowerPoint nests more wrappers, adds `p14` and `mc:AlternateContent` blocks for newer transitions, and uses group ids. The linear scan used here (find each effect node in order, take its first target) is tolerant of nesting but is unproven on a real file.
- **Notes that are not a script.** Cue matching depends on the narrator saying a word from the bullet. Even spacing is a reasonable fallback but will sometimes reveal a bullet early or late.
- **Hiding by transparency.** It held layout in LibreOffice 26.8. Text with its own fill, outlines, gradient text or a paragraph-level bullet colour may not hide cleanly; removal of whole shapes is safe.
- **"Used as written" promise.** The route promises not to change the person's deck. Build states are made on the working copy, which `guardSource` already protects, so the promise holds, but the skill text should say the pictures now include intermediate states.
- **More stills, larger filter graph.** A 40-slide deck with five builds a slide is 240 inputs. Not measured; ffmpeg handles long chains but the command line and memory should be checked.

## Resolved decisions

Decided by the owner on 2026-11-18.

1. **Cross-fades are on by default.** The option turns them off.
2. **A step whose word is never spoken is spaced evenly across the slide's span, with a warning**, as `buildTimeline` does for a slot with no cue.
3. **No real animated deck is available.** The proposal stands on the hand-built test deck. Step 2 still needs a deck written by PowerPoint or exported from Google Slides before it is planned.

## Appendix A: experiments and their output

Scripts are in the shared notes folder under `animate-deck-experiments/`. All ran in a scratch folder; no file in the repository or the person's Documents folder was written.

**1. Fixture deck.** `node test/helpers/make-deck.mjs fixture.pptx`, then counted `<p:timing>` and `<p:transition>` in each of its four slide parts: none in any.

**2. Real deck.** Counted `<p:timing>`, `<p:transition>`, `<p:bldP>` and `<p:cTn>` in each of the 13 slide parts of `prompt-triage-promo-deck.pptx`, read in place with `unzip -p`: none in any.

**3. Animated test deck and what LibreOffice read from it.** `make-animated.mjs` wrote three slides with injected XML:

```
animated slide1:    1 <p:transition
animated slide2:    2 <p:animEffect    3 <p:bldP   10 <p:par    3 <p:set    1 <p:timing    1 <p:transition
animated slide3:    3 <p:animEffect    1 <p:bldP    8 <p:par    3 <p:set    1 <p:timing    1 <p:transition
```

`soffice --headless --convert-to pdf|odp|svg` took 1.05 s, 0.72 s and 0.68 s. The PDF had 3 pages (720 x 405 pt) with all text present: "Three reasons | Shape builds | Alpha arrives first | Bravo fades in | Charlie wipes in | Paragraph builds | Delta point | Echo point | Foxtrot point". The ODP's `content.xml` held 22 `anim:par`, 6 `anim:set`, 8 `anim:transitionFilter`, 5 `presentation:node-type="on-click"`, 1 `after-previous`, 1 `smil:begin="0.75s"`, preset ids `ooo-entrance-appear` (1), `ooo-entrance-fade-in` (4), `ooo-entrance-wipe` (1), and transition types `fade`, `pushWipe` and `barWipe`.

**4. SVG player.** The 502 KB SVG held the same 22 `anim:par` and 8 `anim:transitionFilter` plus one script with `dispatchEffects`, `skipEffect` and `switchSlide`. `svg-step.mjs` loaded it in headless Chromium and pressed ArrowRight nine times with 1.6 s between presses: slide index went 0, 1, 1, 1, 1, 2, 2, 2, 0, 1 with no page errors. Screenshots showed slide 2 with 0, 1, 2 then 3 boxes and slide 3 with 0, 1 then 3 paragraphs, with bullets drawn for the hidden paragraphs and a sans-serif font unlike the PDF path's. `svg-clock-probe.mjs` (Playwright 1.65.1, `page.clock.install`) logged "clock installed" and "loaded" within 0.1 s and then nothing: `clock.runFor(1000)` had not returned when stopped at 18 s.

**5. Build states through LibreOffice.** `build-states.mjs` parsed the steps:

```
slide 1 transition fade  spd="med"
slide 2 transition push  spd="slow"
  step 1 clickEffect preset 1  no filter   dur 0   shape 3
  step 2 clickEffect preset 10 fade        dur 500 shape 4
  step 3 clickEffect preset 22 wipe(left)  dur 500 shape 5
slide 3 transition wipe  spd="med" advTm="3000"
  step 1 clickEffect preset 10 fade dur 500 shape 3 para 0
  step 2 clickEffect preset 10 fade dur 500 shape 3 para 1
         afterEffect preset 10 fade dur 500 delay 750 shape 3 para 2
```

and rendered "4 deck copies rendered in 4.3s" into `slide-01-b0.png`, `slide-02-b0.png` to `-b3.png` and `slide-03-b0.png` to `-b2.png`. A contact sheet showed the expected content in each, hidden bullets gone, and no movement of visible text between states.

**6. Three encodes.** `assemble-animated.mjs` used the engine's own `readDeck`, `estimateWords` and `buildSlideTimeline` from `dist/`, so timing is the silent-preview estimate, not a recording. Cue matches are quoted above. Planned picture changes:

```
  0.00s  cut       0.00s  slide-01-b0.png  (slide 1)
  3.26s  slideleft 0.50s  slide-02-b0.png  (slide 2)
  4.28s  cut       0.00s  slide-02-b1.png  (slide 2 step 1)
  5.39s  fade      0.50s  slide-02-b2.png  (slide 2 step 2)
  7.31s  wiperight 0.50s  slide-02-b3.png  (slide 2 step 3)
  9.18s  wiperight 0.50s  slide-03-b0.png  (slide 3)
  9.41s  fade      0.50s  slide-03-b1.png  (slide 3 step 1)
 11.46s  fade      0.50s  slide-03-b2.png  (slide 3 step 2)
```

Output: `a-cuts.mp4: 3 stills, 16.27s (planned 16.26s), encoded in 0.5s`; `b-crossfades.mp4: 3 stills, 16.27s, encoded in 0.7s`; `c-builds.mp4: 8 stills, 16.27s, encoded in 0.8s`. Pixel (1000, 584) in `c-builds.mp4`: 255 255 255 at 5.30 s and 5.40 s, 193 230 201 at 5.52 s, 134 204 149 at 5.64 s, 89 185 110 at 5.76 s, 30 160 59 at 5.86 s and 5.95 s. The same pixel in `a-cuts.mp4`: 255 255 255 at 3.20 s, 29 159 59 at 3.40 s. Third box during its wipe: at 7.28 s left and right both white; at 7.40 s and 7.56 s left 43 59 199, right white; at 7.70 s both blue. Scene changes at threshold 0.1: `a-cuts` 3.27 s and 9.17 s, `b-crossfades` none, `c-builds` 4.27 s. Frames pulled at 3.26, 4.40, 5.64, 7.56, 9.20, 9.66, 11.71 and 14.0 s showed the push, the half-faded second box, the half-wiped third box, the slide wipe and the paragraphs fading in.

Not tested: a recorded voiceover (it costs credits; the timing code path is the same one `assemble` uses), and sound in these encodes.

**7. Encode cost at real length.** 13 stills of 11.5 s each at 1920 x 1080, `libx264 -preset veryfast -crf 18`: `concat` took 3.82 s (149.5 s of video, 658 KB); a chain of twelve 0.5 s `xfade` fades took 5.79 s (150.0 s, 871 KB).

## Next step

Write a plan for step 1 (cross-fades, on by default) on its own. Step 2 should wait for a real animated deck.
