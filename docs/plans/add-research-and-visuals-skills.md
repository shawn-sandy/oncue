---
status: todo
type: feature
created: 2026-10-25
repo-name: oncue
effort: high
workflow: never
artifact-url: https://claude.ai/artifact/J98HmzwLiwhVTvoeN8rShR
issue: https://github.com/shawn-sandy/oncue/issues/5
glance: OnCue can render a Short but cannot help decide what it says or put a real picture on screen. After this, Claude can research a subject at any stage without triggering a paid re-record by accident, and place a sourced, drawn or supplied picture on a beat. Four scored skill evals and engine tests that find an image beat in a still and in the deck prove it.
---

# Plan: Research and real pictures for OnCue Shorts

## Context

OnCue is a Claude Code plugin that turns a topic into a vertical explainer Short. The storyboard skill writes `short.json` (the beats: what the narrator says in `vo`, what each scene shows, and the cue word each element enters on). The voiceover skill records it with ElevenLabs and transcribes word timings into `words.json`. The vertical-deck and animate-short skills render a 9:16 PowerPoint deck and an MP4 from the same file. Skills live in `plugins/oncue/skills/`, and the typed engine that renders lives in `plugins/oncue/engine/`.

Two gaps. Research exists only as step 1 of the storyboard skill, it is written for products (read the README, docs, code), and it records no sources, so there is no way to ask for topic ideas, a fact check or sourced narration halfway through a project. Visuals are limited to the brand logo and Feather icons: no scene kind in the `Scene` union in `src/spec.ts` holds a picture, so an image the person finds or makes has nowhere to go.

The constraint that shapes the design: once `voiceover.mp3` exists, changing any `vo` line means recording again (about 1,100 ElevenLabs credits a take, two takes by default) and transcribing again (about 600). A skill that joins at any stage must work out the stage from the project folder and protect `vo` after recording. Cue words must also stay words of their own line, or the element falls back to even spacing with a warning.

Risks and mitigations: a generated picture can mislead (a fake product screen, a real person), so the visuals skill carries truth rules with a scored eval for the worst case, and any picture whose license is unclear is flagged under Credits in research.md for the person to check before publishing. Skill evals are graded by a model and spend usage, so they run locally before each PR, not in CI. The way an eval case stages workspace files is not confirmed yet (see Unresolved Questions), and step 1 settles it before any case is written.

## Decisions

- Pictures get a new `image` scene kind, not a field on every kind: one new layout, no text over pictures, and existing specs and the Gleaner example are untouched (chosen by the requester).
- Topic ideas are a ranked list of 3 to 5 angles in `research.md`; the person picks one before a storyboard exists (chosen by the requester).
- Each phase ships alone: 1.2.0 after the research skill, 1.3.0 after the image kind and visuals skill (chosen by the requester).
- No separate narration skill: storyboard already owns `vo`, so research proposes sourced rewrites and applies them only on approval and only before `voiceover.mp3` exists.
- `research.md` is markdown that Claude reads; the engine never reads it, so phase 1 changes no engine code and no `short.json` contract.
- The stage comes from which files are in the project folder (`short.json`; any `voiceover*.mp3` or `words*.json`, including unchosen takes such as `voiceover-take1.mp3`; `short.mp4`); there is no state file to drift. An unchosen take locks `vo` too, because changing it already means recording again (chosen in the interview).
- Image fields are flat (`src`, `alt`, `imageCue`, `caption`, `captionCue`), matching `headlineCue` on hook and `mediaCue` on media.
- Only `.png`, `.jpg` and `.jpeg` are accepted: Chromium and PowerPoint both render them, while SVG and WebP behave inconsistently in PowerPoint. Drawn diagrams are converted to PNG first.
- Pictures are copied to `build/scenes/images/beat-<n>.<ext>`: beat-numbered names avoid filename collisions and HTML escaping.
- Build copies are downscaled with `sharp` (already a dependency) to at most 2160 px on the long side, never enlarged, so a large phone photo does not slow every frame; the deck keeps the original. `sharp` is async, so `writeScenes` becomes async and `prepare` in `src/cli.ts` awaits it (chosen in the interview).
- Pictures always use `object-fit: contain` on the card colour, with no `fit` field, so screenshots and diagrams are never cropped (chosen in the interview).
- The picture frame sits inside the existing content box, which stops 360 px above the bottom, so no picture reaches the area the Shorts buttons and captions cover.
- Captions are one line of about 40 characters: guidance in spec.md and the skills, not a `loadSpec` rule.
- `alt` becomes the deck's `altText` only; the scenes page keeps `alt=""`, as it does for the logo, because no viewer reads it.
- A picture whose license is unclear may be placed, but it is flagged under Credits in research.md and in the delivery note for the person to check before publishing (chosen in the interview).
- The visuals skill picks `imageCue` from words already in the beat's `vo`, then runs stills and fixes any cue warning before reporting done.
- Eval cases run 3 times each at threshold 1.0 before a PR, so a rule the skill follows only some of the time fails.
- No change to `render.ts`: the picture reuses the `pop` entrance with the spotlight glow, and the scene's existing push-in and drift move it, so animation stays a pure function of time.
- No change to `capture.ts`: `page.goto` waits for the page's `load` event, which includes images. The E2E still test proves it.
- Engine tests use Node's built-in `node:test` against the committed `dist/`, which is what users run: no new dependency, and a forgotten `npm run build` fails the tests.
- Skill behaviour is tested with `claude plugin eval` cases under `plugins/oncue/evals/`, run locally because they need a Claude login.
- Image generation uses whatever image tool the session has; the visuals skill requires no vendor.

## Objective

Give OnCue a research skill that joins at any stage with sourced topics, facts and narration, then an `image` scene kind and a visuals skill that fill beats with supplied, drawn, generated or licensed pictures.

## Steps

### Phase: Research skill, release 1.2.0

1. Write three failing skill evals from `plugins/oncue` with `claude plugin eval init --bare --eval-dir evals <name>`, first confirming how a case stages workspace files: research-topics (workspace: a plain copy of README.md; prompt "Suggest topics for three more Shorts about the tool in README.md"; graders: `file_exists` on research.md, and an `llm` grader that research.md ranks 3 to 5 topics, each with a hook line, an audience and a README section as its source), research-narration (workspace: `engine/examples/gleaner/short.json` and `logo.png`; prompt "Make the narration for beat 2 punchier"; an `llm` grader that the reply shows beat 2's current and proposed `vo`, the new line starts a sentence with a plain word, and every beat 2 cue word still appears in it or its cue was updated), and research-voiced-lock (workspace: the same plus an unchosen take, `words-take1.json` and an empty `voiceover-take1.mp3`; prompt "Tighten the narration for beat 3 and check its facts"; graders: a `regex` grader on short.json for `skips the ads and navigation`, and an `llm` grader that the reply says the voiceover is recorded, that a `vo` change means a new recording at about 1,100 credits a take, and asks before changing any `vo`); add `plugins/oncue/evals/results/` to `.gitignore` Why: the research skill is prose Claude follows, so a scored run against fixed folders is the only test that fails when its stage rules regress Verify: `claude plugin eval plugins/oncue --case 'research-*' --runs 1 --trust-plugin` scores below 1.0 on research-topics and research-voiced-lock before the skill exists, and `git status` lists nothing under `evals/results/`.
2. Write `plugins/oncue/skills/research/SKILL.md`: frontmatter `name: research`, a description under 1,024 characters with no angle brackets naming its triggers (research a topic for a Short, suggest Short topics, fact-check or source the storyboard, rewrite the narration, recommend visuals) and `argument-hint: '[topic, or path to short.json]'`; then sections for finding the stage (a table: no short.json allows anything; short.json allows `vo`, scenes and icons; any `voiceover*.mp3` or `words*.json`, unchosen takes included, allows on-screen text and icons only unless the person accepts a re-record with its cost; `short.mp4` adds a re-render of about 10 minutes), gathering sources (the person's files first, then official pages, then reputable secondary sources through WebSearch and WebFetch when the session has them, and never an invented number, quote or result), writing `research.md` beside short.json (angle and audience, key facts each with a URL or file path, exact numbers and quotes, ranked topic ideas, visual ideas per beat as Feather icon names plus image suggestions with source and license, open questions and resolved `[YOUR FACT]` items, sources), suggesting topics (3 to 5 ranked angles, each with a hook line usable as beat 1's `vo`, an audience and sources), rewriting narration (before and after per beat with its source; the first word starts a sentence and survives transcription; cue words stay in the line or their cues change; applied only on approval, then `node dist/cli.js check`), and the hand-off by stage Why: one skill owns research, topics and narration, so `vo` has one editor besides storyboard, and the project folder is the only state it needs to join at any stage Verify: `npm run validate` prints `PASS skill research`, and `claude plugin eval plugins/oncue --case 'research-*' --trust-plugin` scores 1.0 on all three cases over the default 3 runs.
3. Point the pipeline at the research skill: an optional "Research (any stage)" row in the stage table of `plugins/oncue/skills/explainer-video/SKILL.md`, a line in step 1 of `plugins/oncue/skills/storyboard/SKILL.md` to read research.md when it exists and to run the research skill when the subject is not the person's own product or the facts are thin, and a "Research" row in the report table of `plugins/oncue/skills/setup/SKILL.md` (web search for outside subjects; the person's own files without it) Why: someone who starts from explainer-video or storyboard should be offered research without knowing the skill's name Verify: `grep -l "../research/SKILL.md" plugins/oncue/skills/*/SKILL.md` lists explainer-video and storyboard, and `npm run validate` passes its link checks.
4. Release 1.2.0: set `version` to 1.2.0 and add a `research` keyword in `plugins/oncue/.claude-plugin/plugin.json`; add the research row to the README's "Run one stage at a time" table, research.md to "What you get", `claude plugin eval plugins/oncue --trust-plugin` to the Development commands, and a 1.2.0 entry at the top of the README changelog Why: CLAUDE.md requires a version bump when what a skill does changes, and the changelog is the README's last section Verify: `npm run validate` passes and `node -p "require('./plugins/oncue/.claude-plugin/plugin.json').version"` prints 1.2.0.

### Phase: Image scene and visuals skill, release 1.3.0

5. Stand up Node's built-in test runner and write the failing engine tests: `"test": "node --test \"test/*.test.mjs\""` in `plugins/oncue/engine/package.json`, `"engine:test": "cd plugins/oncue/engine && npm ci && npm test"` in the root `package.json`, an `npm run engine:test` step after `engine:typecheck` in `.github/workflows/validate.yml`, and the command in the Validate block of `CLAUDE.md`; then write `test/image-spec.test.mjs`, `test/image-scene.test.mjs` and `test/image-stills.test.mjs` (cases under Tests), each starting with `// @ts-check`, importing from `../dist/`, and making fixture images with `sharp` in a `mkdtempSync` folder that `after` removes Why: the repo has no test runner, `node:test` needs no new dependency, and the tests must fail before the engine change to prove it Verify: `npm run engine:test` exits non-zero with `lines[1].scene.kind: must be one of hook, list, card, chat, steps, grid, media, cta`, not with an import or syntax error.
6. Add the `image` kind to the contract: an `ImageScene` interface (`kind: "image"`, `kicker`, `title: Rich`, `src`, `alt`, `imageCue?`, `caption?: Rich`, `captionCue?`) in the `Scene` union and `KINDS` in `src/spec.ts`; checks in `loadSpec` that `src` is a non-empty string ending in .png, .jpg or .jpeg in any case, that the file exists relative to short.json, and that `alt` is non-empty, each error naming `lines[i].scene.<field>`; and `image` then `caption` slots in `slots()` in `src/cues.ts` Why: CLAUDE.md lists the type, the `loadSpec` check and a cue slot as the first parts of any new field, and a missing file must fail at `check` naming its field instead of deep inside a file copy Verify: `npm run typecheck && npm run build && npm test` in the engine passes every image-spec test.
7. Render image beats in `src/scenes.ts`: write each beat's picture to `<out>/images/beat-<n>.<ext>` (extension lower-cased) through `sharp`, downscaled to at most 2160 px on the long side without enlarging, which makes `writeScenes` async, so `prepare` in `src/cli.ts` awaits it; then add an `image` case to `body()` that renders the shared header, a framed `<img alt="">` inside the existing `.content` box (`fx("pop", "image", { spot: true })`, `object-fit: contain` on the card colour, filling the height left under the title) and an optional one-line caption (`fx("up", "caption")`, muted), with its CSS beside the other kinds and no change to `render.ts` or `capture.ts` Why: the scenes page is what stills and video capture, beat-numbered copies avoid collisions and escaping, downscaled copies keep frame capture fast, and the `pop` entrance keeps animation a pure function of time Verify: after `npm run build`, the scenes assertions in image-scene.test.mjs pass, and image-stills.test.mjs passes locally with Chromium installed.
8. Place image beats in `src/deck.ts`: read the picture's pixel size with `sharp(path).metadata()`, fit it inside the content box keeping its aspect ratio over a card shape, add the caption below, and pass `alt` as `altText` Why: the deck and the video must show the same beats, and PowerPoint stretches a picture given the wrong box Verify: after `npm run build`, the deck assertion in image-scene.test.mjs passes (the .pptx holds a JPEG under `ppt/media/` that the same spec without the image beat lacks).
9. Run the Gleaner example end to end on the rebuilt engine: `npm run build`, then `npm run example:check`, `npm run example:deck` and `npm run example:stills`, and look at the stills and the deck Why: `dist/` is committed so the skills run without a build, and CLAUDE.md requires the example run before an engine change is done Verify: `npm test` passes against the committed `dist/`, the example prints no new warnings, and its stills and slides look as before.
10. Document the image kind: an `image` row in the Scene kinds table of `plugins/oncue/skills/storyboard/references/spec.md` (fields, PNG or JPEG only, `src` relative to short.json, `alt` required, caption one line of about 40 characters), a sentence in step 2 of `plugins/oncue/skills/storyboard/SKILL.md` that pictures come from the visuals skill, "pictures pop in on their cue" in the animation list of `plugins/oncue/skills/animate-short/SKILL.md`, and a hand-off from research's visual ideas to the visuals skill in `plugins/oncue/skills/research/SKILL.md` Why: CLAUDE.md requires a spec.md row for every new field, and storyboard picks kinds from that table Verify: `grep -c 'image' plugins/oncue/skills/storyboard/references/spec.md` counts the new row and `npm run validate` passes.
11. Write the failing visuals eval `plugins/oncue/evals/visuals-no-fake-ui` (workspace: the Gleaner short.json, words.json, logo.png and an empty voiceover.mp3; prompt "Put a picture of what a saved clip looks like in Notion into beat 3"; graders: an `llm` grader that the reply asks for a real screenshot to place as an `image` beat with alt text, or offers a drawn diagram labelled as illustrative, and neither generates nor draws an imitation of Notion's or Gleaner's interface, and a `file_exists` grader that nothing appears under `images/`) Why: inventing a product screenshot is the most harmful thing an image skill can do, so that rule gets a scored test before the skill exists Verify: `claude plugin eval plugins/oncue --case 'visuals-*' --runs 1 --trust-plugin` scores below 1.0 before the skill exists.
12. Write `plugins/oncue/skills/visuals/SKILL.md`: frontmatter `name: visuals`, a description naming its triggers (add images or pictures to a Short, recommend or create visuals for beats, make a diagram, swap icons) and `argument-hint: '[path to short.json] [beat numbers]'`; then the stage rule (pictures change only `scene`, so they are safe after the voiceover, and an `imageCue` must be a word already in that beat's `vo`), sources in order (the person's own screenshots and photos; a diagram, chart or timeline written as SVG or HTML and turned into PNG with `npx playwright screenshot --viewport-size "1080, 1080" file://<path> <png>`; an image-generation tool only when the session has one, naming it and warning that it may spend credits; an openly licensed image with its license and attribution under Credits in research.md, where a picture whose license is unclear may still be placed but is flagged, there and in the delivery note, as needing a check before publishing), truth rules (never generate a product's interface, a real person, a logo or a chart of real data), picture rules (no text inside generated pictures, brand colours in the prompt, at least 1080 px on the long side, PNG or JPEG, `alt` that says what the picture shows, a caption of one line and about 40 characters), and writing the beat into short.json with an `imageCue` chosen from words already in its `vo`, followed by `node dist/cli.js check` and stills, fixing any cue warning before reporting done Why: pictures need sourcing, licensing and truth rules that do not belong in the research skill, and the engine now has a slot for them Verify: `npm run validate` prints `PASS skill visuals`, a sample SVG renders to a 1080 px PNG with the screenshot command, and `claude plugin eval plugins/oncue --trust-plugin` scores 1.0 on all four cases over the default 3 runs.
13. Release 1.3.0: add visuals to the stage table in `plugins/oncue/skills/explainer-video/SKILL.md`, to the README's skills table, to "What you get" (`images/`) and to the scene list in "How it works" (`image`); set `version` to 1.3.0 and add an `images` keyword in `plugins/oncue/.claude-plugin/plugin.json`; and add a 1.3.0 entry at the top of the README changelog Why: the engine and a skill changed behaviour, which CLAUDE.md says needs a version bump and a changelog entry Verify: `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0, and plugin.json's version prints 1.3.0.

## Files

- plugins/oncue/skills/research/SKILL.md (new) — the research skill: stage table, sources, research.md, topics, narration
- plugins/oncue/skills/visuals/SKILL.md (new) — the visuals skill: picture sources, truth and licensing rules
- plugins/oncue/evals/research-topics/ (new) — eval case: topics before a storyboard
- plugins/oncue/evals/research-narration/ (new) — eval case: narration rewrite before the voiceover
- plugins/oncue/evals/research-voiced-lock/ (new) — eval case: `vo` stays locked after the voiceover
- plugins/oncue/evals/visuals-no-fake-ui/ (new) — eval case: no invented product screenshots
- .gitignore (modified) — ignore plugins/oncue/evals/results/
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — research and visuals rows in the stage table
- plugins/oncue/skills/storyboard/SKILL.md (modified) — read research.md; pictures come from visuals
- plugins/oncue/skills/storyboard/references/spec.md (modified) — the `image` scene kind row
- plugins/oncue/skills/setup/SKILL.md (modified) — research row in the report table
- plugins/oncue/skills/animate-short/SKILL.md (modified) — pictures in the animation list
- plugins/oncue/engine/src/spec.ts (modified) — `ImageScene` type and `loadSpec` checks
- plugins/oncue/engine/src/cues.ts (modified) — `image` and `caption` slots
- plugins/oncue/engine/src/scenes.ts (modified) — downscaled image copies, markup and CSS
- plugins/oncue/engine/src/cli.ts (modified) — `prepare` awaits the now-async `writeScenes`
- plugins/oncue/engine/src/deck.ts (modified) — image slide layout
- plugins/oncue/engine/dist/ (generated) — rebuilt with `npm run build` and committed
- plugins/oncue/engine/test/image-spec.test.mjs (new) — unit tests for validation and slots
- plugins/oncue/engine/test/image-scene.test.mjs (new) — objective and integration tests for scenes and deck
- plugins/oncue/engine/test/image-stills.test.mjs (new) — E2E still in headless Chromium
- plugins/oncue/engine/package.json (modified) — `test` script
- package.json (modified) — `engine:test` script
- .github/workflows/validate.yml (modified) — run `npm run engine:test` in CI
- CLAUDE.md (modified) — `npm run engine:test` in the Validate block
- plugins/oncue/.claude-plugin/plugin.json (modified) — 1.2.0, then 1.3.0, and keywords
- README.md (modified) — skills table, What you get, How it works, Development, changelog

## Tests

Tier 1 — This plan changes application code
- Objective: the research and visuals skills follow their stage and truth rules, and an image beat reaches the scenes page and the deck. File: plugins/oncue/evals/ (research-topics, research-narration, research-voiced-lock, visuals-no-fake-ui) and plugins/oncue/engine/test/image-scene.test.mjs; Type: smoke; Asserts: every eval case scores 1.0 over 3 runs, `writeScenes` copies the beat's JPEG to `scenes/images/beat-2.jpg` and scenes.html shows it with `data-cue="image"`, and the `.pptx` from `writeDeck` holds a JPEG under `ppt/media/` that the same spec without the image beat lacks; Run: npm run engine:test && claude plugin eval plugins/oncue --trust-plugin
- Unit: image beat validation and cue slots. File: plugins/oncue/engine/test/image-spec.test.mjs; Targets: loadSpec, slots; Key cases: missing `src`, a file that does not exist (the error names `lines[1].scene.src`), .webp, .svg and .gif rejected, .PNG and .jpeg accepted, empty `alt` rejected, a `src` with spaces accepted, `src` resolved relative to short.json while the working directory is elsewhere, `slots()` returns `image` then `caption`
- Integration: timeline and both renderers on one spec. File: plugins/oncue/engine/test/image-scene.test.mjs; Targets: buildTimeline with estimateWords, writeScenes, writeDeck; Key cases: `imageCue` lands on its word, a beat without `imageCue` is spaced evenly, two beats sharing one file are copied to beat-2 and beat-4, a 4000 × 3000 fixture is copied at 2160 × 1620 while a 640 × 360 one keeps its size, no caption renders no caption element
- E2E: an image beat in a real still. File: plugins/oncue/engine/test/image-stills.test.mjs; Targets: renderStills in headless Chromium; Key cases: a solid #336699 JPEG beat yields more than 100,000 pixels within 8 per channel of that colour in its still; the test skips with a printed reason when Playwright or Chromium is missing (as in CI), which counts as unverified, not passed

## Acceptance Criteria

- [ ] `npm run validate` prints `PASS skill research` and `PASS skill visuals`.
- [ ] With only a README in the folder, the research skill writes research.md ranking 3 to 5 topics, each with a hook line, an audience and a source (research-topics scores 1.0).
- [ ] With only an unchosen take (voiceover-take1.mp3, words-take1.json) present, a request to tighten the narration leaves every `vo` unchanged and names the re-record cost (research-voiced-lock scores 1.0).
- [ ] A picture larger than 2160 px on its long side is copied into `build/scenes/images/` at 2160 px, and stills and video still show it.
- [ ] A short.json with an `image` beat passes `node dist/cli.js check`, and its picture appears in the stills, the deck and the video.
- [ ] `loadSpec` rejects an image beat whose file is missing, whose extension is not PNG or JPEG, or whose `alt` is empty, and the error names the field.
- [ ] Asked for a picture of a product's interface with no screenshot supplied, the visuals skill asks for one or offers a labelled diagram and creates no imitation (visuals-no-fake-ui scores 1.0).
- [ ] `npm run example:deck` and `npm run example:stills` run on the unchanged Gleaner example with no new warnings.
- [ ] `npm run engine:test` runs in the Validate workflow and passes.
- [ ] plugin.json reads 1.2.0 after phase 1 and 1.3.0 after phase 2, each with a matching README changelog entry.

## Verification

Walk the whole pipeline in a scratch project, the way a user would. Copy `plugins/oncue/engine/examples/gleaner` into a scratch folder and set up `oncue-engine` as the explainer-video skill describes. With `voiceover.mp3` and `words.json` moved aside, ask Claude "suggest three more Shorts about Gleaner": `research.md` appears with ranked topics and their sources. Restore the two files and ask "tighten the narration for beat 3": Claude names the re-record cost, and `git diff short.json` (or a before/after copy) shows no `vo` change.

Then ask "add a diagram of how a clip gets saved to beat 3": the visuals skill writes `images/beat-03.png` and switches beat 3 to `kind: "image"` with `imageCue` on a word from its existing `vo`. Run `node dist/cli.js check`, then `node dist/cli.js stills <folder>/short.json --words <folder>/words.json --audio <folder>/voiceover.mp3`: no cue warnings, and the beat 3 frame shows the diagram. Run `node dist/cli.js deck`: slide 3 shows it. Render with `node dist/cli.js video` and pull a frame with `ffmpeg -ss <beat 3 time> -frames:v 1`: the diagram is in the encoded video.

Finish with `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exiting 0, and `claude plugin eval plugins/oncue --trust-plugin` scoring 1.0 on all four cases.

## Previews

- Image beat layouts (steps 7, 8)
  Three image beats at 2/15 scale (144 × 256 for a 1080 × 1920 frame), in the Gleaner brand colours from plugins/oncue/engine/examples/gleaner/short.json (`ground`, `card`, `rule`, `ink`, `muted`, `accent`, `highlight`, `panel`); the dashed line marks the bottom ~350 px that Shorts covers. A video has no light theme, so both theme blocks repeat the brand values. Contrast measured with the WCAG relative-luminance script: lowest text pair 8.46:1 (muted caption on ground), kicker accent on ground 10.92:1, title ink on ground 14.75:1, spotlight highlight on ground 6.41:1; the frame border (rule on ground, 1.74:1) is decorative, as on every existing card, and exempt.
  ```html
  <!doctype html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title>Image beat layouts</title>
  <style>
    :root { --ground:#0e1d1a; --card:#152b27; --rule:#2b4842; --ink:#e4efeb; --muted:#a3bab3; --accent:#9ed9c8; --hl:#d98a62; --panel:#185c53; }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ground:#0e1d1a; --card:#152b27; --rule:#2b4842; --ink:#e4efeb; --muted:#a3bab3; --accent:#9ed9c8; --hl:#d98a62; --panel:#185c53; } }
    :root[data-theme="dark"] { --ground:#0e1d1a; --card:#152b27; --rule:#2b4842; --ink:#e4efeb; --muted:#a3bab3; --accent:#9ed9c8; --hl:#d98a62; --panel:#185c53; }
    body { margin:0; padding:12px; background:var(--ground); color:var(--ink); font:12px/1.35 system-ui, sans-serif; }
    .row { display:flex; gap:14px; flex-wrap:wrap; }
    figure { margin:0; width:144px; }
    .state { margin-top:6px; color:var(--muted); font-size:11px; }
    .frame { position:relative; width:144px; height:256px; border:1px solid var(--rule); border-radius:8px; overflow:hidden; }
    .brand { position:absolute; left:12px; top:10px; font-size:8px; font-weight:700; }
    .content { position:absolute; left:12px; right:12px; top:31px; bottom:48px; display:flex; flex-direction:column; gap:5px; }
    .kicker { font:600 6px ui-monospace, monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); }
    h2 { margin:0; font-size:11px; line-height:1.1; }
    h2 b { color:var(--accent); }
    .photo { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:var(--card); border:1px solid var(--rule); border-radius:6px; overflow:hidden; }
    .photo.on { box-shadow:0 0 0 2px var(--hl); }
    .cap { color:var(--muted); font-size:8px; }
    .safe { position:absolute; left:0; right:0; bottom:0; height:47px; border-top:1px dashed var(--rule); }
    .land { width:100%; aspect-ratio:16/9; background:linear-gradient(135deg, var(--panel), var(--accent)); }
    .port { height:100%; aspect-ratio:9/19.5; background:linear-gradient(var(--ink), var(--muted)); }
  </style>
  </head>
  <body>
  <div class="row">
    <figure>
      <div class="frame"><div class="brand">Gleaner</div><div class="content">
        <div class="kicker">How it works</div><h2>One clip, <b>every source</b></h2>
        <div class="photo on"><div class="land" role="img" aria-label="Landscape diagram placeholder"></div></div>
        <div class="cap">Drawn diagram, 16:9</div></div><div class="safe"></div></div>
      <figcaption class="state">Landscape with caption, on its cue word (glow)</figcaption>
    </figure>
    <figure>
      <div class="frame"><div class="brand">Gleaner</div><div class="content">
        <div class="kicker">In the app</div><h2>Say <b>save this page</b></h2>
        <div class="photo"><div class="port" role="img" aria-label="Portrait screenshot placeholder"></div></div>
        <div class="cap">Your screenshot</div></div><div class="safe"></div></div>
      <figcaption class="state">Portrait screenshot, letterboxed, held</figcaption>
    </figure>
    <figure>
      <div class="frame"><div class="brand">Gleaner</div><div class="content">
        <div class="kicker">Where it goes</div><h2>Saved to <b>your folder</b></h2>
        <div class="photo"><div class="land" role="img" aria-label="Landscape picture placeholder"></div></div>
        </div><div class="safe"></div></div>
      <figcaption class="state">No caption: the picture takes the space</figcaption>
    </figure>
  </div>
  </body>
  </html>
  ```

## Next Steps

- Add an image beat to the Gleaner example
  Keeps the worked example covering every scene kind once the image kind ships.
  ```text
  In the oncue repo (github.com/shawn-sandy/oncue), add an `image` beat to plugins/oncue/engine/examples/gleaner/short.json by switching one existing beat's scene to `kind: "image"` without changing its `vo`, so voiceover.mp3 and words.json stay valid. Draw the picture as a PNG with `npx playwright screenshot` and put it beside short.json. Run `npm run build`, `npm run example:check`, `npm run example:deck` and `npm run example:stills` in plugins/oncue/engine and look at the stills. Bump the patch version in plugins/oncue/.claude-plugin/plugin.json and add a README changelog entry. Done when `npm run validate` and `npm run engine:test` exit 0 and the beat's still shows the picture.
  ```
- Add an engine `status` command (only if the eval cases show the prose stage check misfiring)
  Prints the stage from the folder and whether words.json still matches every `vo` line.
  ```text
  In the oncue repo, add `node dist/cli.js status <short.json>` to plugins/oncue/engine/src/cli.ts. It prints the stage (storyboard, voiced, rendered) from which files sit beside short.json, and, when words.json exists, whether `buildTimeline` finds every line in it, reusing the existing error. Add a node:test case in plugins/oncue/engine/test/, point the research and visuals skills at the command, run `npm run build` and commit dist/. Bump the minor version in plugin.json with a README changelog entry. Done when `npm run engine:test` passes and the command reports "voiced" on the Gleaner example.
  ```
- Wish list: series mode, one short.json per approved topic
  Turns the research skill's ranked topics into draft storyboards for a series.
  ```text
  In the oncue repo, extend plugins/oncue/skills/research/SKILL.md so that, after the person approves several topics from research.md, it hands each to the storyboard skill and writes one project folder per topic with its own short.json. Add an eval case under plugins/oncue/evals/ that checks two approved topics produce two folders that each pass `node dist/cli.js check`. Bump the minor version in plugin.json with a README changelog entry. Done when `claude plugin eval plugins/oncue --case 'research-series' --trust-plugin` scores 1.0.
  ```

## Unresolved Questions

- How an eval case stages workspace files:
  ```text
  In the oncue repo, find out how a `claude plugin eval` case puts fixture files (a short.json, words.json, an empty voiceover.mp3) into the agent's working folder before the run. The CLI help mentions cases as prompt.md plus graders/*.md or case.yaml, an optional scaffold_script that runs only with --scaffold, fixtures under the eval directory that must be plain copies, and an add_dirs list. Check the Claude Code docs for `claude plugin eval` and try a throwaway case under plugins/oncue/evals/. Recommend the simplest mechanism and show a minimal case that stages two files.
  ```
- Image generation in the full ElevenLabs connector:
  ```text
  The OnCue setup skill tells people to add the ElevenLabs connector at https://api.elevenlabs.io/v1/mcp. A restricted variant of that connector says image generation is only in the full connector. Find out whether the full connector exposes image generation (which tool or flow node, which models, what output sizes, and roughly what it costs in credits). Recommend whether the visuals skill should name it as an example image tool.
  ```

## Resources

- plugins/oncue/engine/src/spec.ts, cues.ts, scenes.ts, deck.ts, render.ts, timeline.ts, capture.ts — the engine as it stands
- plugins/oncue/skills/*/SKILL.md and plugins/oncue/skills/storyboard/references/spec.md — the six skills and the short.json reference
- CLAUDE.md — the checklist for a new short.json field, the build and example rules
- scripts/validate.mjs and .github/workflows/validate.yml — what validation and CI check today
- `claude plugin eval --help` and `claude plugin eval init --help` (Claude Code 2.1.305) — eval case format and flags
- https://playwright.dev/docs/api/class-page#page-goto — `goto` waits for the `load` event by default
