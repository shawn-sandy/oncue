---
status: todo
type: feature
created: 2026-10-26
repo-name: oncue
workflow: never
artifact-url: https://claude.ai/artifact/Djf6ZAqSh2LMg17XWyQDCE
issue: https://github.com/shawn-sandy/oncue/issues/12
glance: OnCue already installs in Codex, and a ChatGPT workspace admin can import it, but its skills tell every reader to use claude.ai and Claude Code commands, and its engine can only launch the Chromium that Playwright downloads, which ChatGPT's offline container cannot fetch. After this, setup gives Codex and ChatGPT users their own instructions, the other skills name no product, every skill states what it needs, and the engine can use a browser that is already installed. We know it worked when the ChatGPT probe results are recorded in this plan, `npm run validate` rejects product-specific wording outside setup, and stills render with ONCUE_CHROMIUM_PATH pointing at a real browser.
---

# Plan: Run OnCue in Codex and imported into ChatGPT, with setup that knows which product it is in

## Objective

Make OnCue usable through a ChatGPT workspace marketplace import and in Codex: probe the ChatGPT container first, keep product-specific instructions in the setup skill's per-product branches, give every skill an Agent Skills `compatibility` field, and let the engine launch an installed Chromium through `ONCUE_CHROMIUM_PATH`.

## Context

An exploration on 2026-10-26 mapped what OnCue needs to run outside Claude Code. Codex CLI 0.155.1 reads `.claude-plugin/marketplace.json` as it is: with a throwaway `CODEX_HOME`, `codex plugin marketplace add <repo>` and `codex plugin add oncue@oncue` installed version 1.2.0 with all six skills and the `engine/` folder, so the skills' `../../engine` path works there. Whether a Codex session then finds the skills was not tested, because that needs a signed-in session. OpenAI's docs say a ChatGPT workspace admin (Business, Enterprise or Edu) can import a GitHub marketplace in this format, synced daily. Gleaner, the author's other plugin, uses that route.

What breaks is the runtime and the wording. Reports of ChatGPT's code container (Simon Willison, January 2026) describe Node 22.16, npm reaching the registry only through an internal proxy, and no other outbound network. Community reports from July and August 2026 say that npm proxy returned 503 and then 404 errors. That means `npx playwright install chromium`, which downloads from Playwright's own server, cannot work there. The engine's `chromium.launch()` at `plugins/oncue/engine/src/capture.ts:19` takes no browser path. Whether ffmpeg, ffprobe or any Chromium exists in the container is undocumented. The skills also send every reader to claude.ai Settings, Claude Code slash commands and "the person's folder when their computer is linked", which OpenAI asks plugin instructions to avoid.

Risks and how the plan handles them:

- The container facts are second-hand. Steps 1 and 2 observe them, and the ChatGPT branch of setup is written only from what they record.
- Step 2 needs a workspace admin. Without one, the import is recorded as not tested, and the README says the ChatGPT path is untested.
- The `docs/plans/support-other-voice-engines.md` plan (issue #10, not yet implemented) also edits setup section 6, `explainer-video/SKILL.md` lines 38 and 42, the README, `plugin.json`, and adds the engine `test` script. Whichever plan lands second rebases onto the first. The script and CI additions here are add-if-absent, in the same form.

## Decisions

- Targets are Codex and the ChatGPT workspace import only. Single-skill uploads, other Agent Skills hosts and OpenAI's public directory are follow-ups, because they need the engine moved inside a skill or a hosted renderer.
- Keep the `.claude-plugin/` layout with no portable `plugin.json` or `.codex-plugin/` manifest. Codex and the ChatGPT import both read it, and a second manifest would break CLAUDE.md's rule that the version lives only in `plugins/oncue/.claude-plugin/plugin.json`.
- Keep `argument-hint`. Claude Code uses it, and Gleaner ships it and still imports into ChatGPT. Failing the strict `skills-ref` validator is accepted for now.
- Product-specific instructions live only in `setup/SKILL.md`. Other skills point to "the host's network settings (the setup skill lists where)", so a new product needs one new branch in setup, not a sweep of every skill.
- The browser override is a new environment variable, `ONCUE_CHROMIUM_PATH`, passed to `chromium.launch({ executablePath })`. Playwright has no environment variable for a launch path, and `PLAYWRIGHT_BROWSERS_PATH` only moves Playwright's own downloads.
- Test before change. The engine phase writes `capture.test.mjs` first and watches it fail, using Node's built-in runner (`node --test`) so no dependency is added. Context phases are used instead of RED/GREEN/VERIFY/SHIP headings, because the probe and skills phases have nothing to fail.
- Shipping ffmpeg through npm, and a hosted renderer, are out of scope unless the probe shows they are needed. They are listed under Next Steps.
- The version is one minor bump over whatever `plugin.json` holds when this is implemented: 1.3.0 if the voice-engine plan has not landed, 1.4.0 if it has. Whichever plan is ready lands first (2026-10-26 interview).
- If the probe shows npm cannot install the engine in ChatGPT, setup's ChatGPT branch reports which outputs are blocked and why, and the plan ships anyway. Shipping prebuilt `node_modules` was rejected as megabytes of native binaries for one host (2026-10-26 interview).
- Setup picks a branch from the product running the session, not from shell detection, because one machine can have both the `claude` and `codex` CLIs on `PATH` (2026-10-26 interview).
- The variable is named `ONCUE_CHROMIUM_PATH`, not `CHROME_PATH`, so an unrelated value another tool reads is never picked up (2026-10-26 interview).

## Files

- docs/plans/support-chatgpt-workspace-and-codex.md (modified) — probe and import results recorded under Decisions
- plugins/oncue/engine/test/capture.test.mjs (new) — unit test for `launchOptions`
- plugins/oncue/engine/src/capture.ts (modified) — `launchOptions` and the `chromium.launch` call
- plugins/oncue/engine/dist/capture.js (generated) — rebuilt with `npm run build`
- plugins/oncue/engine/package.json (modified) — `test` script, if absent
- scripts/validate.mjs (modified) — `compatibility` and product-wording checks
- plugins/oncue/skills/setup/SKILL.md (modified) — per-product branches and `compatibility`
- plugins/oncue/skills/explainer-video/SKILL.md (modified) — neutral delivery and network lines, `compatibility`
- plugins/oncue/skills/animate-short/SKILL.md (modified) — neutral delivery line, `compatibility`
- plugins/oncue/skills/voiceover/SKILL.md (modified) — neutral network line, `compatibility`
- plugins/oncue/skills/storyboard/SKILL.md (modified) — `compatibility`
- plugins/oncue/skills/vertical-deck/SKILL.md (modified) — `compatibility`
- README.md (modified) — Codex and ChatGPT install, `ONCUE_CHROMIUM_PATH`, changelog entry
- plugins/oncue/.claude-plugin/plugin.json (modified) — minor version bump
- package.json (modified) — root `engine:test` script, if absent
- .github/workflows/validate.yml (modified) — `npm run engine:test` step, if absent

## Steps

### Phase: Probe

1. Run the ChatGPT container probe. The person pastes `In your code container, run each command and paste the raw output: node -v; npm -v; npm view pptxgenjs version; npm view sharp version; npm view playwright version; which ffmpeg ffprobe chromium chromium-browser google-chrome; ls ~/.cache/ms-playwright; python3 -c "import playwright; print(playwright.__version__)"; sleep 150 && echo survived-150s` into a ChatGPT chat with code execution. Record the results as dated bullets under `## Decisions` in this spec: the Node version, whether npm reaches the registry, which browser binary exists and its path, whether ffmpeg and ffprobe are present, and whether a 150-second command survives. Why: the container is undocumented, and the ChatGPT branch of the setup skill must come from what the container actually has, not from second-hand reports. Verify: `## Decisions` has one bullet per probed item, each with the observed value or error text, and none hedges with "probably".
2. Check the imported plugin in ChatGPT. When a workspace admin has imported `shawn-sandy/oncue`, ask ChatGPT to run the OnCue setup skill and list `<plugin>/engine/dist`. Record under `## Decisions` whether the six skills appear, whether the engine folder is reachable from the setup skill, and what setup reports. With no admin access, record "workspace import not tested". Why: only a real import shows whether ChatGPT mounts the plugin root next to the skills, and that decides whether `../../engine` resolves there at all. Verify: `## Decisions` has an "Import:" bullet holding either the observed results or the literal text "workspace import not tested".

### Phase: Engine

3. Write the failing test first. Create `plugins/oncue/engine/test/capture.test.mjs` (`// @ts-check`, `node:test` and `node:assert/strict`, importing `launchOptions` from `../dist/capture.js`) with three cases: an unset `ONCUE_CHROMIUM_PATH` gives `{}`, an empty value gives `{}`, and `/opt/chromium/chrome` gives `{ executablePath: "/opt/chromium/chrome" }`. Add `"test": "node --test test/*.test.mjs"` to `plugins/oncue/engine/package.json` unless a `test` script already exists. Why: a test that fails before the change proves the override rather than assuming it, and matching the voice-engine plan's script lets whichever plan lands second keep the first one's script. Verify: `npm test` in `plugins/oncue/engine` exits non-zero with `launchOptions is not a function`; paste the output.
4. Add `export function launchOptions(env = process.env)` to `plugins/oncue/engine/src/capture.ts`. It returns `{ executablePath }` when `ONCUE_CHROMIUM_PATH` is non-empty and `{}` otherwise, written as a conditional object because `exactOptionalPropertyTypes` rejects an `undefined` property. Pass it to `chromium.launch` at line 19 and run `npm run build`. Why: Playwright downloads Chromium from its own server, which ChatGPT's container cannot reach, and nothing else lets the engine launch a browser that is already installed. Verify: in `plugins/oncue/engine`, `npm test` and `npm run typecheck` exit 0. `ONCUE_CHROMIUM_PATH="$(node -p "require('playwright').chromium.executablePath()")" node dist/cli.js stills examples/gleaner/short.json` exits 0 and writes styled frames to `examples/gleaner/build/stills/`. With `ONCUE_CHROMIUM_PATH=/nonexistent/chrome` the same command exits non-zero with an error naming that path.

### Phase: Skills

5. Make `scripts/validate.mjs` require a single-line `compatibility` frontmatter field on every skill (at most 500 characters, no angle brackets, the same rules as `description`), run it and watch it fail for all six skills, then add the field to each `plugins/oncue/skills/*/SKILL.md`, naming only what that skill needs: Node.js 22+ and the plugin's bundled `engine/` folder for storyboard, vertical-deck, animate-short and explainer-video; Playwright Chromium or `ONCUE_CHROMIUM_PATH` for preview stills and video; ffmpeg and ffprobe for video; the ElevenLabs MCP connector, or the person's own MP3 and `words.json`, for voiceover; and a shell for setup. Why: `compatibility` is the Agent Skills standard's field for environment requirements, so the person or the product can see what a skill needs before it fails mid-run. Verify: `npm run validate` fails naming all six skills before the fields exist and exits 0 after.
6. Add a check to `scripts/validate.mjs` that fails when any skill other than `setup` contains the word "claude" in any case, the slash commands `/plugin`, `/mcp` or `/reload-plugins`, or a sentence pairing "computer" with "linked" (the regex `computer[^.]*linked`, which matches both wordings in use today), then reword the four lines it flags: `explainer-video/SKILL.md:38` and `animate-short/SKILL.md:42` say to save copies to the folder the person named when the session can write there, and `explainer-video/SKILL.md:42` and `voiceover/SKILL.md:47` say to allow `storage.googleapis.com` in the host's network settings (the setup skill lists where) or to attach the MP3. Why: OpenAI asks plugin instructions to name no provider, and the check stops product-specific wording from creeping back in. Verify: `npm run validate` fails on exactly those four lines before the rewording and exits 0 after.
7. Add per-product branches to `plugins/oncue/skills/setup/SKILL.md`: a "Host" note after line 12 saying to use the branch for the product running the session (Claude Code, Codex or ChatGPT); in section 1, Codex reports `oncue@oncue` and its version through `codex plugin list` and updates through `codex plugin marketplace upgrade oncue` then `codex plugin add oncue@oncue` (this assumes `upgrade` alone does not refresh the installed copy; confirm before writing it), while in ChatGPT a workspace admin installs OnCue and it syncs daily, so setup reports the loaded version and gives no command; in section 4, when the probe recorded npm failing in ChatGPT, the ChatGPT branch says the engine cannot install there and which outputs that blocks; in section 5, when `npx playwright install chromium` cannot download, use the browser path the probe found and set `ONCUE_CHROMIUM_PATH`; in section 6, Codex connects ElevenLabs with `codex mcp add elevenlabs --url https://api.elevenlabs.io/v1/mcp` then `codex mcp login elevenlabs`, and ChatGPT uses ElevenLabs as step 2 found it, or the person's own MP3; and split line 104 into per-product network notes (Claude: claude.ai Settings → Capabilities; Codex: what `codex sandbox` shows about network access; ChatGPT: no allowlist, so attach the MP3). Why: setup is the one place commands for a specific product belong, and each line must come from a command that ran or from a recorded probe result. Verify: in a throwaway `CODEX_HOME` every Codex command in the new text exits 0, including `codex plugin marketplace add shawn-sandy/oncue`, `codex mcp list` after the `add`, and `codex sandbox -- npm view pptxgenjs version`, whose result decides the Codex network line; every ChatGPT line traces to a `## Decisions` bullet; and `npm run validate` exits 0.

### Phase: Release

8. Update `README.md`: under `## Install` add a "Codex and ChatGPT" subsection with the Codex commands verified in step 7 and the ChatGPT workspace import (admin only, Business, Enterprise or Edu, synced daily) with the outputs the probe showed working, or "untested" when step 2 could not run; document `ONCUE_CHROMIUM_PATH` under `## The engine`; and add an entry for the new version at the top of `## Changelog`. Why: people find install paths in the README, and the changelog is the release record. Verify: `npm run validate` exits 0 (it checks README links), and `grep -n ONCUE_CHROMIUM_PATH README.md` shows the engine section line.
9. Bump `plugins/oncue/.claude-plugin/plugin.json` one minor version so it matches the new changelog heading. Add `"engine:test": "cd plugins/oncue/engine && npm test"` to the root `package.json` and `- run: npm run engine:test` after the typecheck step in `.github/workflows/validate.yml`, each only if it is not already there. Why: CLAUDE.md requires a version bump when a skill or the engine changes behaviour, and a test that CI never runs rots. Verify: `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0 from the repo root, and `node -p "require('./plugins/oncue/.claude-plugin/plugin.json').version"` prints the changelog's top version.

## Tests

Tier 1 — This plan changes application code
- Objective: OnCue's skills name no product outside setup and declare their requirements, and the engine launches the browser `ONCUE_CHROMIUM_PATH` names. File: scripts/validate.mjs (new checks) and plugins/oncue/engine/test/capture.test.mjs; Type: smoke; Asserts: every skill has a `compatibility` field of at most 500 characters, no skill but setup contains "claude", the product slash commands or the `computer[^.]*linked` phrase, and `launchOptions` maps `ONCUE_CHROMIUM_PATH` to `executablePath`; Run: npm run validate && npm run engine:test
- Unit: browser launch options. File: plugins/oncue/engine/test/capture.test.mjs; Targets: `launchOptions` in src/capture.ts; Key cases: variable unset, empty string, a real path
- Integration: CI runs both suites. File: .github/workflows/validate.yml; Targets: root `validate` and `engine:test` scripts; Key cases: a failing frontmatter check or engine test fails the job

## Acceptance Criteria

- [ ] `## Decisions` records the ChatGPT probe: the Node version, npm registry access, the browser binary, ffmpeg and ffprobe, and the 150-second run. It also has an "Import:" bullet, and each entry is an observed value or "not tested".
- [ ] `grep -rliE 'claude|computer[^.]*linked' plugins/oncue/skills --include=SKILL.md` prints only `plugins/oncue/skills/setup/SKILL.md`.
- [ ] All six SKILL.md files carry a `compatibility` field, and `npm run validate` fails when one is removed.
- [ ] `setup/SKILL.md` has Claude Code, Codex and ChatGPT branches for the plugin check, Chromium, ElevenLabs and network access, and every Codex command in it exited 0 in a throwaway `CODEX_HOME`.
- [ ] In `plugins/oncue/engine`, stills render with `ONCUE_CHROMIUM_PATH` set to Playwright's Chromium, and a nonexistent path fails with an error naming it.
- [ ] `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0 from the repo root.
- [ ] The `plugin.json` version equals the README changelog's first heading and is one minor above its value before this plan.

## Verification

Install the branch the way a Codex user would. With a fresh throwaway `CODEX_HOME`, run `codex plugin marketplace add <worktree path>` and `codex plugin add oncue@oncue`. Confirm that `codex plugin list` shows `oncue@oncue` at the new version, that every `SKILL.md` in the installed cache has a `compatibility` line, and that `node -e "console.log(typeof require('<cache>/engine/dist/capture.js').launchOptions)"` prints `function`.

Then, in a signed-in Codex session (the person's own, or the throwaway home after `codex login`; the person runs or approves this, since it uses their account), run `codex exec "List the OnCue skills you can use and the absolute path of the setup skill"` and confirm it names all six skills.

In `plugins/oncue/engine`, run the two `ONCUE_CHROMIUM_PATH` stills commands from step 4 and open one frame: it shows a styled card on a dark ground. Finally, `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0 from the repo root.

The ChatGPT import syncs from `main`, so its end-to-end check runs after merge: once the daily sync picks up the new version, run the setup skill in ChatGPT and confirm it takes the ChatGPT branch and reports the outputs the probe predicted.

## Next Steps

- Ship ffmpeg and ffprobe through npm when the probe finds them missing in ChatGPT
  Only if step 1 recorded ffmpeg or ffprobe as missing.
  ```text
  In the oncue repo (shawn-sandy/oncue), ChatGPT's code container lacks ffmpeg or ffprobe (see the Decisions section of docs/plans/support-chatgpt-workspace-and-codex.md). Check whether @ffmpeg-installer/ffmpeg and @ffprobe-installer/ffprobe install through ChatGPT's npm proxy and ship a linux-x64 binary. If they do, add a ChatGPT branch to section 3 of plugins/oncue/skills/setup/SKILL.md that installs them into oncue-engine and puts their binaries on PATH. Do not add them to the engine's dependencies. Bump the minor version in plugins/oncue/.claude-plugin/plugin.json and add a README changelog entry. Verify: in ChatGPT, setup reports ffmpeg and ffprobe ready, and npm run validate exits 0 locally.
  ```
- Package OnCue as one self-contained skill for single-skill uploads and other Agent Skills hosts
  ChatGPT skill upload, OpenAI's Skills API and `.agents/skills` folders install one skill folder at a time, so `../../engine` breaks there.
  ```text
  In the oncue repo (shawn-sandy/oncue), add a script that generates a single `oncue` Agent Skill from plugins/oncue: one SKILL.md routing to the six stages, the stage docs under references/, the engine under scripts/engine/, every path relative to the skill root, and no argument-hint. Leave the Claude plugin layout unchanged and do not commit the generated output. Verify: the skills-ref validator (github.com/agentskills/agentskills) passes on the generated folder, and node scripts/engine/dist/cli.js check on the bundled example prints OK.
  ```
- Pass the strict Agent Skills validator
  Wish list: only needed if a host rejects `argument-hint`.
  ```text
  In the oncue repo (shawn-sandy/oncue), plugins/oncue/skills/*/SKILL.md use argument-hint, which the Agent Skills skills-ref validator rejects as an unexpected field. Decide between moving each value under metadata.argument-hint and stripping it in a portable build, check what Claude Code reads, and implement the choice. Verify: skills-ref validate passes on every skill folder, and claude plugin validate still exits 0.
  ```

## Unresolved Questions

- Is a ChatGPT workspace with admin rights available for step 2?
  ```text
  For docs/plans/support-chatgpt-workspace-and-codex.md step 2 in the oncue repo, find out whether the person has admin rights in a ChatGPT Business, Enterprise or Edu workspace that can import the GitHub marketplace shawn-sandy/oncue. If not, recommend whether to ship with the ChatGPT path marked untested or to wait.
  ```

## Resources

- [Agent Skills specification](https://agentskills.io/specification) — the `compatibility` field and its 500-character limit
- [skills-ref validator](https://github.com/agentskills/agentskills) — the allowed frontmatter fields
- [OpenAI: Package your plugin](https://developers.openai.com/plugins/build/plugins) — manifest formats Codex and ChatGPT accept
- [OpenAI: Submit a Claude Code plugin](https://developers.openai.com/plugins/guides/submit-claude-plugin) — provider-neutral wording and what the converter drops
- [OpenAI Help: Importing plugin marketplaces from GitHub](https://help.openai.com/en/articles/20001504-importing-and-syncing-plugin-marketplaces-from-github) — the admin-only workspace import and its daily sync
- [Simon Willison: ChatGPT containers](https://simonwillison.net/2026/Jan/26/chatgpt-containers/) — Node 22.16, the npm and pip proxy, no outbound network
- [OpenAI community: container npm registry 404](https://community.openai.com/t/chatgpt-container-internal-npm-registry-changed-from-http-503-to-http-404-npm-installs-remain-unavailable/1388749) — the proxy outage behind the probe's npm checks
- docs/plans/support-other-voice-engines.md — the overlapping voice-engine plan this one is sequenced against
