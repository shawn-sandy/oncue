---
status: todo
type: feature
created: 2026-10-30
repo-name: oncue
effort: medium
workflow: never
artifact-url: https://claude.ai/artifact/CH9eSHwNRcaoYxspEG3Jke
issue: https://github.com/shawn-sandy/oncue/issues/21
glance: Today setup ends with a working machine and an example request, so every video gathers its subject, audience, goals, look and narrator from scratch, and nothing is kept for the next one. After this change a person leaves setup with a project they can keep adding videos to, and each video starts from what they already decided. We will know it works when a second video in a project asks none of those questions again and matches the first video's look.
---

# Plan: Setup takes a person from install to a ready project

## Objective

Teach the setup skill to start a project: a folder for one subject, a `brief.md` holding that subject, its overall goals and its narrator, a base `DESIGN.md`, and a hand-off to the first video, so every later video in the project starts from those files instead of asking again.

## Context

OnCue's setup skill checks the machine and stops. Its last instruction is to suggest an example request (`plugins/oncue/skills/setup/SKILL.md` step 7), and the README's first step is only "Start Claude Code in the folder where the project should live". Findings from exploring the code on 2026-10-30:

- **Nothing creates a project folder.** `plugins/oncue/skills/research/SKILL.md` defines it as whichever folder holds `short.json`, `plugins/oncue/skills/storyboard/SKILL.md` step 3 says "in a project folder", and `plugins/oncue/skills/voiceover/SKILL.md` step 4 downloads into it. No skill names or makes one.
- **Subject and goals are not kept.** Storyboard step 1 gathers what it is, who it is for and the call to action for every video. The nearest thing saved is the "Angle and audience" section of `research.md`, which is per video and exists only when research ran.
- **The base design is not shared.** Every `short.json` carries its own `brand` and `theme`. Issue https://github.com/shawn-sandy/oncue/issues/17 (`docs/plans/support-project-design-systems.md`) adds the design search, reuse and DESIGN.md saving. It is open and none of it has landed.
- **The narrator is picked per video.** `plugins/oncue/skills/voiceover/SKILL.md` step 2 chooses a voice every time, so a series can change narrator between videos.
- **The folder layout works in the engine.** `loadSpec` in `plugins/oncue/engine/src/spec.ts` resolves `brand.logo` from the spec's folder with no guard against `..`. On 2026-10-30, in a scratch workspace with one `oncue-engine/` and a video folder nested in a project folder, `check` and `deck` both passed with `brand.logo` set to `../logo.png`. Stills and video were not run, because that copy had no Playwright. They use the same resolved path (`writeScenes` in `plugins/oncue/engine/src/scenes.ts`), and Verification closes that gap.

Prerequisite: issue #17 ships first. This plan needs its `## Spotting a look` and `## Saving the look as DESIGN.md` sections in `references/theme.md`. Its plan still says version 1.5.0, which is taken, so it needs the next free minor version when it is built.

Risks and how the plan handles them:

- **Existing flat folders.** Every read of `brief.md` is conditional, so a folder with `short.json` and a logo side by side behaves exactly as it does today. The four existing evals use flat folders and must keep passing.
- **Interrupting someone mid-video.** The failed-stage entry to setup must not turn into a project pitch. Setup offers a project only when the working folder and the folders directly under it hold neither `brief.md` nor `short.json`.
- **`brief.md` is a common filename.** Setup writes only into a new folder, so it can never overwrite one. A skill that reads a brief says which file it read, so a stray one is visible at once.
- **Writing into the person's repo.** `.gitignore` changes only on a yes, and a DESIGN.md elsewhere in the repo is never edited.
- **Sessions that do not persist.** In claude.ai and cloud sessions the working folder disappears with the session, so setup says so and hands over the files.

## Decisions

- **A project is one subject with several videos.** "Base design" and "overall goals" only mean something when several videos share them. Chosen by the person.
- **Projects sit directly in the working folder,** beside `oncue-engine/`, so finding one is a one-level look and a product repo can commit it. Chosen by the person.
- **Three levels.** The working folder holds `oncue-engine/`, one copy as today. A project folder holds `brief.md`, `DESIGN.md` and `logo.png`. A video folder holds `short.json` and everything the pipeline writes (`research.md`, `images/`, `voiceover.mp3`, `words.json`, `build/`). "Video folder" replaces today's "project folder" wording, because the word project now means the outer level.
- **No engine change.** `brief.md` is read by Claude only, like `research.md`. The engine and the `short.json` contract stay as they are, so `dist/` and `references/spec.md` are untouched.
- **`brief.md` format lives in the setup skill**, as the `research.md` format lives in the research skill, so no new reference file. It holds `# Brief: <subject>`, then `## Subject` with `Name on screen:`, `Logo:` and `Sources:` lines, `## Audience`, `## Goals`, `## Call to action`, `## Where it's posted` and `## Voice`.
- **Unknowns stay visible.** A question the person leaves open is written as `[YOUR FACT]`, OnCue's existing marker, and the storyboard asks for it later.
- **Finding a project.** `brief.md` beside `short.json` or in its parent folder; before a `short.json` exists, in the working folder or one level below, asking which when there are several. Storyboard step 1 holds the rule and research points to it, so it is written once.
- **The project's `DESIGN.md` is always in the saved format.** It uses the 13 OnCue colour role names from `## Saving the look as DESIGN.md`, so it reads back one to one with no judgement. A DESIGN.md found elsewhere is a source, mapped once and never edited.
- **The project's `DESIGN.md` beats an earlier Short.** It is the base design, so editing that one file changes every later video. This reverses issue #17's order inside a project only. Earlier Shorts count only inside the same project folder, so one project's look never leaks into another. Chosen by the person.
- **The narrator is part of the brief.** `## Voice` holds the person's description and, once one is picked, a `Chosen voice:` line. Chosen by the person.
- **The brief stores a voice's name, never its id.** The connector's ids must come from `creative_list_voices` or the person, so the voiceover skill looks the name up each time, which also shows when a voice has gone. Setup only records the description: it never calls an ElevenLabs tool.
- **A voice named for this video wins over the brief.** The chosen voice is saved to the brief only on a yes, like an approved look.
- **An approved look that differs from `DESIGN.md` is saved back on a yes.** Otherwise a contrast fix on video one would be lost on video two. This is the only exception to issue #17's rule that a DESIGN.md is never overwritten.
- **No design preview in setup.** The engine cannot read `DESIGN.md`, so a preview would need a scratch spec and Playwright. The first storyboard's stills show the look, and the beats cannot lock until the person has seen it.
- **The logo sits in the project folder.** It is copied there as `logo.png`, and each video's `brand.logo` is `../logo.png`. A logo that is not a PNG keeps its path on the `Logo:` line for the storyboard to convert.
- **The walkthrough asks once.** One message, only for what the request and the files have not answered, so a person who gives everything up front gets no questions.
- **Two ways in.** A full setup offers a project as its one next step once everything is ready. "Start a new project" jumps straight to it, because it writes text files only and needs no engine.
- **The explainer-video skill needs no edit.** It hands gathering to the storyboard skill, which holds all the new rules.
- **Version.** The next minor after issue #17 ships: 1.8.0 if that one takes 1.7.0.

## Files

- plugins/oncue/skills/setup/SKILL.md (modified) — new step 8, entry rules in the intro and step 7, new trigger phrases
- plugins/oncue/skills/storyboard/SKILL.md (modified) — read the brief, write the video folder, offer to save an approved look back
- plugins/oncue/skills/storyboard/references/theme.md (modified) — the project's `DESIGN.md` first, earlier Shorts limited to the project, where the file is saved
- plugins/oncue/skills/research/SKILL.md (modified) — read the brief, "video folder" wording
- plugins/oncue/skills/voiceover/SKILL.md (modified) — reuse the brief's voice, offer to save the chosen one, "video folder" wording
- plugins/oncue/evals/setup-start-project/case.yaml (new) — eval case
- plugins/oncue/evals/setup-start-project/fixture.sh (new) — copies the fixtures
- plugins/oncue/evals/setup-start-project/prompt.md (new) — the request
- plugins/oncue/evals/setup-start-project/fixtures/README.md (new) — a small made-up CLI
- plugins/oncue/evals/setup-start-project/graders/skill-fired.md (new) — the setup skill ran
- plugins/oncue/evals/setup-start-project/graders/brief-written.md (new) — `acme-cli/brief.md` exists
- plugins/oncue/evals/setup-start-project/graders/design-written.md (new) — `acme-cli/DESIGN.md` exists
- plugins/oncue/evals/setup-start-project/graders/voice-recorded.md (new) — `acme-cli/brief.md` holds the narrator described in the prompt
- plugins/oncue/evals/setup-start-project/graders/no-spec.md (new) — no `short.json` was written
- plugins/oncue/evals/setup-start-project/graders/hand-off.md (new) — the reply names the folder and offers a first video
- plugins/oncue/evals/storyboard-project-brief/case.yaml (new) — eval case
- plugins/oncue/evals/storyboard-project-brief/fixture.sh (new) — copies the fixtures
- plugins/oncue/evals/storyboard-project-brief/prompt.md (new) — the request
- plugins/oncue/evals/storyboard-project-brief/fixtures/acme-cli/brief.md (new) — a finished brief
- plugins/oncue/evals/storyboard-project-brief/fixtures/acme-cli/DESIGN.md (new) — a base design in the saved format
- plugins/oncue/evals/storyboard-project-brief/fixtures/acme-cli/logo.png (new) — copied from `research-narration/fixtures/`
- plugins/oncue/evals/storyboard-project-brief/graders/skill-fired.md (new) — the storyboard skill ran
- plugins/oncue/evals/storyboard-project-brief/graders/spec-in-video-folder.md (new) — `acme-cli/install-in-60s/short.json` exists
- plugins/oncue/evals/storyboard-project-brief/graders/shared-logo.md (new) — `brand.logo` is `../logo.png`
- plugins/oncue/evals/storyboard-project-brief/graders/base-colour.md (new) — `ground` comes from the base design
- plugins/oncue/evals/storyboard-project-brief/graders/no-repeat-questions.md (new) — the reply does not ask again for what the brief answers
- plugins/oncue/.claude-plugin/plugin.json (modified) — next minor version
- README.md (modified) — a "Start a project" section, the setup row, a changelog entry

## Steps

1. Confirm issue #17 has landed, by checking that `plugins/oncue/skills/storyboard/references/theme.md` has `## Spotting a look` and `## Saving the look as DESIGN.md`. If it has not, stop and build `docs/plans/support-project-design-systems.md` first, on the next free minor version. Why: the walkthrough saves its base design through those sections, so building on a missing format would leave `DESIGN.md` with nothing to follow. Verify: `grep -c "## Spotting a look\|## Saving the look as DESIGN.md" plugins/oncue/skills/storyboard/references/theme.md` prints 2, and `npm run validate` exits 0.
2. Add the `plugins/oncue/evals/setup-start-project/` eval in the shape of `research-topics`, with a fixture README for a made-up CLI called Acme, a prompt that asks to start an OnCue project in a folder named `acme-cli` and gives the audience, goals, call to action, posting place, "a warm, unhurried narrator" and "dark with a teal accent", a `prompt.md` tool list of `[Read, Glob, Grep, Skill, Write, Edit]`, and the graders listed under Files. Why: skill text has no unit tests, so this is the regression test, and it is written first so it can be seen failing. Verify: `claude plugin eval plugins/oncue --case 'setup-start-project' --scaffold --allow-tools Write Edit --trust-plugin --runs 1 --threshold 1` exits 1 because `acme-cli/brief.md` is missing.
3. Add the `plugins/oncue/evals/storyboard-project-brief/` eval, with a fixture project of `acme-cli/brief.md`, `acme-cli/DESIGN.md` in the saved format and `acme-cli/logo.png`, a prompt asking for a 45-second video in a folder named `install-in-60s`, and the graders listed under Files. Why: the point of the project is that the next video does not start over, and this asserts that directly. Verify: the same eval command with `--case 'storyboard-project-brief'` exits 1.
4. Add `## 8. Start a project` to `plugins/oncue/skills/setup/SKILL.md` after `## 7. Report`. It looks for `brief.md` in the working folder and one level below, skipping `oncue-engine*`, `node_modules`, `build` and `dist`, and when it finds any it names them and asks whether the new video belongs to one, handing off to the storyboard skill if so. Otherwise it asks in one message for whatever the request and files have not answered: the subject (offering a one-line summary from the README when there is one), the audience, the overall goals, the call to action, where the videos will be posted and the narrator in plain words. It then proposes a lower-case hyphenated folder name, never writes into an existing non-empty folder, writes `brief.md` in the format under Decisions with unanswered items as `[YOUR FACT]`, and copies a PNG logo in as `logo.png`. Why: this is the missing step that gives a project a place and a record, and it spends no credits and needs no engine. Verify: `grep -n "## 8. Start a project" plugins/oncue/skills/setup/SKILL.md` prints one line and `npm run validate` exits 0.
5. Extend step 8 with the base design and the hand-off. Base design: take what the person gives, or run theme.md's `Spotting a look` from the working folder, then write `DESIGN.md` into the project folder by `Saving the look as DESIGN.md`, leaving any source file untouched; with nothing to go on, use the existing fallback and say what was chosen; when the person says to skip it, write none and say the storyboard will offer later. Hand-off: name the project's path and what was written, list open `[YOUR FACT]` items, say to start later sessions in the folder holding `oncue-engine/`, in a git repository offer to add `oncue-engine*/` and `build/` to `.gitignore` and write it only on a yes, in a sandboxed session say the folder will not outlast the session and send the files, and end with one example request for the first video. Why: the base design is what makes later videos match, and the hand-off is what turns setup into a start rather than a report. Verify: step 8 links `../storyboard/references/theme.md`, and `npm run validate` exits 0, which checks links.
6. Wire up both ways into step 8. Add to the intro of `plugins/oncue/skills/setup/SKILL.md` that a person who asked only to start a project goes straight to step 8. Change the end of step 7 so that, when everything is ready and the working folder and the folders directly under it hold neither `brief.md` nor `short.json`, the one next step is offering step 8, and otherwise it stays as it is. Add starting a new project to the skill's `description`, within the 1,024-character limit. Why: a second project should not re-run the machine checks, and a person fixing a failed stage mid-video should not be pitched a project. Verify: `npm run validate` exits 0, and the description contains "new project".
7. Update `plugins/oncue/skills/storyboard/SKILL.md`. Step 1 starts by finding the project by the rule under Decisions, says which brief it read, takes the subject, audience, goals, call to action and default `format` from it, asks only for this video's angle and any `[YOUR FACT]`, and also reads the project folder's `research.md`. Step 3 writes `short.json` in a video folder, `<project>/<video-name>/`, with `brand.name` from `Name on screen:` and `brand.logo` set to `../logo.png`, and with no brief keeps today's flat folder. Step 5 offers, when the approved look differs from the project's `DESIGN.md`, to update that file, and writes it only on a yes. Why: the storyboard is where every video gathers its material, so reading the brief here covers the explainer-video skill too. Verify: `grep -c "brief.md" plugins/oncue/skills/storyboard/SKILL.md` prints at least 3, and `npm run validate` exits 0.
8. Update `plugins/oncue/skills/storyboard/references/theme.md`. In `## Spotting a look`, inside a project the project's `DESIGN.md` comes first and earlier Shorts count only inside that project folder, with the rest of the search unchanged. In `## Saving the look as DESIGN.md`, a new file goes in the project folder when there is one, and the project's own file may be updated on a yes. Why: without this, issue #17's search would copy any earlier Short in the workspace, so one project's look could land in another, and an edited base design would be ignored. Verify: `grep -n "project folder" plugins/oncue/skills/storyboard/references/theme.md` prints a line in each of the two sections, and `npm run validate` exits 0.
9. Update `plugins/oncue/skills/research/SKILL.md`: the description and steps 1 to 3 say "video folder", with no `short.json` the folder is the project folder when the storyboard skill's rule finds one and else the working folder, `brief.md` joins the person's own files in step 2, and `research.md` goes in that same folder. Why: one word must not mean two folders, and topic ideas for a project belong with the project rather than with one video. Verify: `grep -n "project folder" plugins/oncue/skills/research/SKILL.md` prints only lines about the folder holding `brief.md`, and `npm run validate` exits 0.
10. Update `plugins/oncue/skills/voiceover/SKILL.md`. Step 2 finds the project by the storyboard skill's rule and says which brief it read; a voice the person named for this video wins; otherwise a `Chosen voice:` line is looked up by name with `creative_list_voices` and reused, or, when that voice has gone, reported and replaced; otherwise the `## Voice` description goes to `creative_list_voices` as the person's description. After step 4 saves the files, when the brief has no `Chosen voice:` line, offer to add the voice used, writing only the name and only on a yes. Step 4 says "video folder". Why: a series should keep one narrator, and storing the name rather than the id keeps to the connector's rule that an id comes from the tool or the person. Verify: `grep -c "Chosen voice:" plugins/oncue/skills/voiceover/SKILL.md` prints at least 2, `grep -n "project folder" plugins/oncue/skills/voiceover/SKILL.md` prints nothing, and `npm run validate` exits 0.
11. Release it: bump `version` in `plugins/oncue/.claude-plugin/plugin.json` to the next minor, add `### Start a project` under `## Usage` in `README.md` with the three-level layout and what setup asks, update the setup row in the skills table, and add a changelog entry. Why: `CLAUDE.md` asks for a version bump when what a skill does changes, and the README is where a new person learns the layout. Verify: `grep -n "^### Start a project" README.md` prints one line, the changelog's newest heading matches `plugin.json`, and `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0.

## Tests

Tier 2 — This plan doesn't change application code
- Objective: a project made by setup gives a second video the first video's look without repeating its questions. File: the two `short.json` files written by the smoke run in a scratch workspace (not committed), plus `plugins/oncue/evals/setup-start-project/` and `plugins/oncue/evals/storyboard-project-brief/`; Type: smoke; Asserts: both specs have equal `brand.colors`, `fonts`, `deckFonts` and `logo`, and equal `theme` `radius`, `density`, `type` and `background`, `check` accepts the second spec, and both evals score 1; Run: in `<W>/oncue-engine`, `node -e "const r=require('path').resolve,[a,b]=process.argv.slice(1).map(f=>require(r(f))),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),t=s=>['radius','density','type','background'].map(k=>s.theme?.[k]),bad=['colors','fonts','deckFonts','logo'].filter(k=>!same(a.brand[k],b.brand[k]));if(bad.length||!same(t(a),t(b))){console.error('differs:',bad.join(', ')||'theme');process.exit(1)}" ../acme-cli/first/short.json ../acme-cli/second/short.json && node dist/cli.js check ../acme-cli/second/short.json`, then from the repo root `claude plugin eval plugins/oncue --case '*project*' --scaffold --allow-tools Write Edit --trust-plugin --threshold 1`

## Acceptance Criteria

- [ ] After a full setup with everything ready, in a folder with no `brief.md` or `short.json`, setup offers to start a project as its one next step.
- [ ] Asking to start a new project skips the machine checks and writes no engine copy.
- [ ] The walkthrough writes `<project>/brief.md` and `<project>/DESIGN.md`, writes no `short.json`, calls no ElevenLabs tool, and leaves anything unanswered as `[YOUR FACT]`.
- [ ] A person who gives everything in one message is asked no further questions.
- [ ] Setup never writes into an existing non-empty folder, and a project with the same name leads to a different folder name, not an overwrite.
- [ ] When a project already exists, setup names it and offers to add a video to it before making another.
- [ ] A person fixing a failed stage in a folder that already has a `short.json` is not offered a project.
- [ ] `brief.md` records the narrator the person described, and setup makes no ElevenLabs call to do it.
- [ ] A new video in a project lands in `<project>/<video-name>/`, with `brand.logo` set to `../logo.png`, and `check`, `stills`, `deck` and `video` all accept it.
- [ ] The second video in a project asks only for its angle and any `[YOUR FACT]`, and its `brand` and `theme` keys in the objective test equal the first video's.
- [ ] Once a chosen voice is saved to the brief, the next video in the project uses that voice without asking, and a voice named for one video is used for that video alone.
- [ ] `brief.md` never holds a voice id, and a saved voice that is no longer available is reported instead of silently replaced.
- [ ] Editing a colour in the project's `DESIGN.md` changes the next video and leaves earlier videos' `short.json` files untouched.
- [ ] When the approved look differs from `DESIGN.md`, the storyboard offers to update it, and answering no leaves the file byte-identical.
- [ ] A video in a second project in the same workspace never copies the first project's look.
- [ ] A flat folder with no `brief.md` behaves as it does on main, and the four existing evals still pass.
- [ ] `git diff main -- plugins/oncue/engine` prints nothing.

## Verification

Run these in fresh scratch workspaces, set up the way the setup skill does. They need a Claude login, and the evals spend usage, so run them locally.

**Run A, the full path:** in a folder holding only a small README, ask to set up OnCue. Setup should report, offer a project, and walk through it. Afterwards `<W>/acme-cli/brief.md`, `DESIGN.md` and `logo.png` exist, and `find <W> -name short.json -not -path '*/oncue-engine*'` prints nothing.

**Run B, two videos:** in the same workspace, ask for a video called `first`. The skill should say which brief it read and ask only for the angle. Run `check`, `stills`, `deck` and `video` on `<W>/acme-cli/first/short.json`, which closes the gap left by the 2026-10-30 scratch test, and open a still to see the logo. Then ask for a video called `second` and run the objective test's command, which should exit 0.

**Run C, editing the base design:** change `accent` in `<W>/acme-cli/DESIGN.md` and ask for a third video. It should use the new colour. `git diff --no-index` against a saved copy shows `first/short.json` and `second/short.json` unchanged.

**Run D, saving a look back:** during a new video, ask for a different accent and approve the stills. The skill should offer to update `DESIGN.md`. Answer no and `cmp` against a saved copy exits 0. Repeat, answer yes, and the file has the new accent.

**Run E, a second project:** ask to start a new project, using another look. Setup should skip the machine checks and name `acme-cli`. A video in the new project must not copy `acme-cli`'s colours.

**Run F, a flat folder:** in a folder with `short.json` and `logo.png` side by side and no `brief.md`, run the research and storyboard skills and ask to set up OnCue. They should behave as on main, and setup should not offer a project.

**Run G, a product repository:** in a git repository, run the walkthrough. Setup should offer to change `.gitignore`. Answer no and `git status --short .gitignore` prints nothing.

**Run H, the narrator:** this run spends ElevenLabs credits, so get the person's go-ahead and use a spec of two short beats to keep the takes small. Voice `first`, and the skill should use the brief's description and offer to save the voice it used. Answer yes: `brief.md` gains a `Chosen voice:` line with a name and no id. Voice `second`: the skill should name that same voice without asking. Voice a third video while naming a different narrator: that voice is used and the brief is unchanged. Then change the `Chosen voice:` line to a name that does not exist and voice again up to the point of generating: the skill should say the voice has gone before generating anything.

Last, `claude plugin eval plugins/oncue --scaffold --allow-tools Write Edit --trust-plugin --threshold 1` exits 0 across all six cases, and `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0. `git diff main -- plugins/oncue/engine` prints nothing, so `npm run example:stills` output matches main's.

## Next Steps

- Move an existing flat video into a project
  Someone who made videos before this release has no way to bring them in without editing paths by hand.
  ```text
  In the oncue repo, add a short section to plugins/oncue/skills/setup/SKILL.md that moves an existing folder holding short.json into a project as a video folder, moves its logo to the project folder, sets brand.logo to ../logo.png, and leaves voiceover.mp3 and words.json in place. Ask before moving anything. Bump the minor version in plugins/oncue/.claude-plugin/plugin.json and add a changelog entry at the end of README.md. Verify: `node dist/cli.js check <project>/<video>/short.json` and `node dist/cli.js stills <project>/<video>/short.json` exit 0 on a moved folder, and `npm run validate` exits 0.
  ```

## Resources

- docs/plans/support-project-design-systems.md and https://github.com/shawn-sandy/oncue/issues/17 — the prerequisite, and the source of the DESIGN.md format and the search this plan adjusts.
- plugins/oncue/skills/research/SKILL.md — the pattern followed here: a Markdown file only Claude reads, with its format inline in the skill.
- plugins/oncue/evals/research-topics/ and plugins/oncue/evals/visuals-no-fake-ui/ — the eval shape and the grader types used.
- plugins/oncue/engine/src/spec.ts and plugins/oncue/engine/src/scenes.ts — how `brand.logo` is resolved and copied.
