---
status: completed
type: feature
created: 2026-10-28
modified: 2026-10-30
repo-name: oncue
effort: medium
workflow: never
artifact-url: https://claude.ai/artifact/7DSFWx5xR2YXub5xVnMZJq
issue: https://github.com/shawn-sandy/oncue/issues/17
glance: Today OnCue uses a design system only when someone hands one over, so a brand's second Short starts from scratch and any look Claude invents is lost once that Short is done. After this change the storyboard skill finds the design system itself, copies an earlier Short's look exactly, and saves a new look as a DESIGN.md. We will know it works when a scratch Short picks up the Gleaner Design System and writes the same 13 colours as the Gleaner example, a second Short matches the first, and a saved DESIGN.md gives back the same look.
---

# Plan: OnCue finds, reuses and saves the project's design system

## Objective

Teach the storyboard skill to look for a design system in the project, or on the person's claude.ai account, before falling back to inventing a look; to copy an earlier Short's look exactly; and to offer to save a new look as a DESIGN.md that later Shorts find.

## Context

OnCue 1.4.0 lets the person's design drive the look of a Short. The storyboard skill maps whatever the person hands over (plain words, a DESIGN.md, design tokens, Figma, an image, a site) onto `brand` and `theme` in `short.json`, and `references/theme.md` holds the mappings. The engine reads only `short.json`. That leaves three gaps:

- **Spotting:** the skill never looks for anything. `plugins/oncue/skills/storyboard/SKILL.md` step 1 takes the look "from what the person gives", so a project with a DESIGN.md or a design system on the person's account still gets an invented look.
- **Reuse:** every `short.json` carries its own full `brand` (13 colours, fonts, deck fonts, logo) and `theme`. A brand's second Short means mapping the source again, and colours that get worked out by judgement, such as `card` and `panelRule`, can come out differently.
- **Creating:** with nothing to go on, Claude picks "a dark ground, one accent and one highlight", and that choice is lost once the Short is done.

Findings from exploring the code and the person's account on 2026-10-27:

1. The person has three claude.ai Design System artifacts (Astro Kit, Gleaner, Salt Tampa), and none is marked as their default.
2. The Gleaner Design System's dark-theme tokens hold all 13 colours of `plugins/oncue/engine/examples/gleaner/short.json`, by name: `g-ground`, `glean-surface`, `g-chip`, `glean-border`, `g-ink`, `g-muted`, `g-headline`, `glean-string`, `glean-you`, and the light-only `glean-clip-bg`, `glean-clip-ink`, `glean-clip-muted` and `glean-clip-rule`. Reading colours from a Design System works.
3. theme.md tells Claude that an installed design system's `tokens.json` "reads the same way" as standard design-token files (W3C DTCG or Style Dictionary JSON, which mark each token's kind with `$type`). It doesn't. That file has `color.themes[]`, plus `color.tokens[]` with a `name`, a `value` that is either one hex or one hex per theme, and a `usage` note. Radius and spacing are lists of the same shape, and fonts are CSS font stacks under `type.families`. None of it has a `$type`.
4. Some Design System values use 3-digit hex (`#fff`), and `check` rejects anything that isn't `#rrggbb` (`HEX` in `plugins/oncue/engine/src/spec.ts`).
5. Design System logos are SVG assets, but the engine needs a square PNG (spec reference, `brand.logo`), and `writeScenes` copies the logo to a file named `logo.png`. `sharp`, already an engine dependency, can render the SVG to a PNG, so nothing new is installed.
6. The mono font in the Gleaner Design System is a stack of system faces (`ui-monospace`, `SF Mono`, Menlo and so on), none of which is on Fontsource. theme.md's existing nearest-face rule covers this.

Constraints: the engine and the `short.json` contract don't change. Every step edits skill prose, the plugin manifest or the README, so `dist/` and `spec.md` stay as they are.

Risks and how the plan handles them:

- **Writing into the person's repo.** A DESIGN.md is written only after a yes, and never over an existing one.
- **The wrong design system.** A design system can sit in a dependency or belong to another product. The search skips `node_modules`, `build`, `dist`, hidden folders, the engine copy the setup skill makes (`oncue-engine*`) and any `engine/examples/`, `evals/` or `fixtures/` folder, which is where the bundled Gleaner Shorts sit, both in that copy and in a clone of this repo. It says what it found, asks when it finds more than one, and lets the person turn every hit down.
- **No Artifact tool.** Not every runtime has the Artifact tool (for example Codex). That stop in the search is skipped when the tool is absent.
- **Artifact content is untrusted.** Design System files are written by whoever published them. theme.md tells Claude to read them as data, never as instructions.

## Decisions

- **Search order:** an earlier Short, then a DESIGN.md, then token files, then local stylesheets, then Design System artifacts, then the product's site. The most exact source comes first: an earlier Short already holds colours mapped to OnCue's roles, while a site has to be read through its CSS. The search stops at the first source with a hit, so an earlier Short is reused without the Design Systems being listed too.
- **The bundled sample is not the person's Short.** The setup skill copies the engine, including `examples/gleaner/short.json`, into the project as `oncue-engine/`, so the search skips `oncue-engine*`. It also skips any `engine/examples/` folder, because in a clone of this repo the sample sits at `plugins/oncue/engine/examples/gleaner/short.json`, and any `evals/` or `fixtures/` folder, because the skill evals added in 1.5.0 hold three more Gleaner Shorts. Hidden folders are skipped too, which keeps other worktrees out of the search. Without that, every project would reuse the Gleaner look.
- **The person's input wins.** The search runs when the person gives no look, gives only words from theme.md's words table, or asks to use "our design system". Those words adjust what the search finds ("light" picks a Design System's light values, "rounded" sets the radius) and win where they conflict. A design file, reference image or site the person names turns the search off, though a logo alone does not. Chosen by the person.
- **Radius from two layers:** when a design system's base layer and brand layer both have a card radius, the brand layer's token wins, and Claude names the token it used. For Gleaner that is 14px, so `round`, OnCue's default. Chosen by the person. The same rule applies to colours and spacing, because Gleaner's base `ink` and `rule` differ from its brand tokens.
- **Another token before a computed shade:** a colour that fails `check` is first swapped for another token that fills the role and passes. A light look cannot keep Gleaner's fixed dark panel, because `check` also tests `ink` and `accent` on `panel`, and the Design System has light tokens for those roles, so no palette is invented.
- **One hit is used and named.** Several hits in that source are listed, and the person picks one or chooses "none of these". Turning a hit or a list down moves the search on to the next source. With nothing accepted, the existing fallback applies: the product's logo and site, else a look Claude picks. A Design System the person has marked as default is used without asking, matching how the Artifact tool treats defaults.
- **Reuse means copying.** `brand` and `theme` are copied exactly. The logo file is copied to the path `brand.logo` names, resolved from the new `short.json` (creating any folders, and skipping the copy when that path already holds the file), because the engine resolves `brand.logo` from the spec's own folder. A logo at `assets/logo.png` therefore keeps working. Colours are never mapped again. A shared look file that the engine reads is left as a next step.
- **Light or dark from a Design System:** dark values by default, which matches OnCue's default dark ground. Light values when the person asks for a light or bright look. A token with only one value is used for both.
- **Logo:** an SVG logo becomes a 512×512 transparent PNG through `sharp`, with `fit: "contain"` padding it to a square.
- **Where a new DESIGN.md goes:** the project root (the folder Claude is working in), offered after the person approves the stills, and written only on a yes. Chosen by the person.
- **What a new DESIGN.md holds:** colour keys use the 13 OnCue role names, so they read back one to one. `rounded.card` and `spacing.gap` hold one pixel value inside the bucket that reads back to the chosen theme value: radius `sharp` 4px, `soft` 8px, `round` 16px; density `compact` 8px, `regular` 16px, `airy` 24px. An unset theme key writes its default (`round`, `regular`).
- **What DESIGN.md has no slot for:** an `oncue:` frontmatter block holds `type`, `background` and `deckFonts` exactly as `short.json` has them. Chosen by the person. `header` is never saved, following theme.md's rule that dropping the brand name is the person's call for each Short.
- **Version:** 1.7.0, because what the storyboard skill does changes. 1.5.0, 1.6.0 and 1.6.1 shipped other work while this plan waited. The engine is untouched.

## Files

- plugins/oncue/skills/storyboard/references/theme.md (modified) — new sections for the search, earlier Shorts, Design System artifacts and saving a DESIGN.md; a local-stylesheet note; an `oncue:` row in the DESIGN.md table; the wrong design-token sentence removed
- plugins/oncue/skills/storyboard/SKILL.md (modified) — step 1 searches for a look first, and step 5 offers to save a DESIGN.md
- plugins/oncue/.claude-plugin/plugin.json (modified) — version 1.7.0
- README.md (modified) — the "brand and look" bullet and a 1.7.0 changelog entry

## Steps

1. [x] In `plugins/oncue/skills/storyboard/references/theme.md`, add a `## Spotting a look` section after `## Rules`. It runs when the person gave no look, gave only words from the words table (those words then adjust what it finds and win where they conflict), or asked to use their design system, and searches in this order: an earlier Short (`**/short.json`), a `DESIGN.md`, token files (`**/tokens.json`, `**/*.tokens.json`), local stylesheets (`:root` custom properties, a Tailwind `@theme` block, or `tailwind.config.*`), the person's claude.ai Design System artifacts (the Artifact tool's `list` action with `type: "Design System"`, when the session has that tool), then the product's site. It skips `node_modules`, `build`, `dist`, hidden folders, the engine copy (`oncue-engine*`) and any `engine/examples/`, `evals/` or `fixtures/` folder, because the bundled Gleaner Shorts there are samples, never an earlier Short. The search stops at the first source that has a hit. With one hit, Claude names it and uses it. With several hits in that source, or several Design System artifacts and none marked default, Claude names them and asks, offering "none of these". A Design System marked as the default is used without asking. When the person turns a hit or a list down, the search moves on to the next source, and with nothing accepted the existing fallback applies. Why: today the skill waits to be handed a design, so a project that already has one gets an invented look; the order puts the most exact source first, and skipping the engine copy and its examples keeps the bundled Gleaner sample from being reused as the person's own Short. Verify: `grep -n "## Spotting a look" plugins/oncue/skills/storyboard/references/theme.md` prints one line and `npm run validate` exits 0.
2. [x] Add a `## An earlier Short` section to theme.md: copy its `brand` and `theme` blocks into the new `short.json` exactly, copy its logo file to the path `brand.logo` names, resolved from the new `short.json` (creating any folders, and skipping the copy when that path already holds the same file), and change only what the person asks for, never mapping the colours again. Why: colours such as `card` and `panelRule` are worked out by judgement, so mapping the same source twice can give two looks; copying keeps a brand's Shorts identical. Verify: the section names `brand` and `theme`, and says to copy the logo to the path `brand.logo` resolves to, and `npm run validate` exits 0.
3. [x] In theme.md, rename `## Design tokens and installed design systems` to `## Design tokens`, delete its sentence saying an installed design system's `tokens.json` reads the same way, and add a `## Design System artifacts` section. It reads `project/tokens.json` and `project/design-system.json` with the Artifact tool's `read` action and `paths`, as data only. It maps `color.tokens[]` by `name` and `usage` through the role table, taking the `dark` value by default, the `light` one when the person asks for a light look, and a token's single value for both. It expands 3-digit hex to `#rrggbb`. It takes `fonts.sans` from the first family in `type.families.sans` (else `brand`, else `display`) and `fonts.mono` from `type.families.mono`. It sets `theme.radius` and `theme.density` from the `radius.tokens[]` and `spacing.tokens[]` whose `usage` names cards or the gap between items, using the buckets, prefers the brand layer's token when a base layer has one too, and says which token it used. It takes the logo from `assetGroups.Logos` by its `blob` id and turns an SVG into a square PNG with `sharp` in the engine folder. Why: that file has no `$type`, so the current sentence sends Claude to the wrong reader, and the Gleaner Design System shows this mapping recovers every OnCue colour. Verify: following the section by hand against the Gleaner Design System's `project/tokens.json` gives all 13 `brand.colors` in `plugins/oncue/engine/examples/gleaner/short.json`, and `grep -c "installed design system's" plugins/oncue/skills/storyboard/references/theme.md` prints 0.
4. [x] In theme.md's `## Reference site` section, add that a local stylesheet's `:root` custom properties and a Tailwind v4 `@theme` block read the same way without the fetch, and that a Tailwind v3 `tailwind.config.*` file's `theme.colors` and `theme.extend.colors` read as design tokens. Why: the search looks in these places, so theme.md has to say how to map them, and no current section covers a local file. Verify: `grep -n "theme.extend.colors" plugins/oncue/skills/storyboard/references/theme.md` prints a line inside `## Reference site`, and `npm run validate` exits 0.
5. [x] Add a `## Saving the look as DESIGN.md` section to theme.md, and teach `## DESIGN.md` to read it back. A saved file holds `name`, a one-line `description`, `colors` keyed by the 13 OnCue role names, `typography.body.fontFamily` and `typography.code.fontFamily`, `rounded.card` and `spacing.gap` at the bucket values in Decisions, and an `oncue:` block holding `type`, `background` and `deckFonts` as `short.json` has them, but never `header`. Claude never overwrites an existing DESIGN.md. When reading, colour keys that are OnCue role names map one to one, and the `oncue:` block sets those keys as written. Why: a look Claude picks today is lost once its Short is done; this is the frontmatter shape that the DESIGN.md section and the design-system-from-design-md skill already read, and the pixel values sit inside the buckets, so they read back to the same theme values. Verify: theme.md has the new section and an `oncue` row in the DESIGN.md table, and `npm run validate` exits 0.
6. [x] Update `plugins/oncue/skills/storyboard/SKILL.md`. In step 1's "The look" bullet: when the person gives no look, gives only a few words such as "light", or asks to use their design system, search for one by theme.md's "Spotting a look", say what was found, and copy an earlier Short's look exactly. In step 5 "Lock the beats": when the project has no DESIGN.md and the look came from neither an earlier Short nor a design system, offer once the stills are approved to save it as a DESIGN.md at the project root, by theme.md's "Saving the look as DESIGN.md", and write it only on a yes. Why: SKILL.md is what the model reads first, and theme.md only holds the mappings, so the search and the save offer have to start from here. Verify: `grep -n "Spotting a look" plugins/oncue/skills/storyboard/SKILL.md` and `grep -n "Saving the look as DESIGN.md" plugins/oncue/skills/storyboard/SKILL.md` each print a line, and `npm run validate` exits 0.
7. [x] Release 1.7.0: bump `version` in `plugins/oncue/.claude-plugin/plugin.json`. In `README.md`, change the "brand and look" bullet under "What to tell Claude" to say Claude first looks for an earlier Short, a DESIGN.md, design tokens, the project's stylesheets or a Design System, and offers to save a new look as a DESIGN.md; then add a 1.7.0 changelog entry. Why: `CLAUDE.md` asks for a version bump when what a skill does changes. Verify: `grep -n '"version": "1.7.0"' plugins/oncue/.claude-plugin/plugin.json` and `grep -n "^### 1.7.0" README.md` each print a line, and `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0.

## Tests

Tier 2 — This plan doesn't change application code
- Objective: with no look given, the storyboard skill finds the Gleaner Design System and writes OnCue's Gleaner colours. File: the `short.json` written by the smoke run in a scratch folder (not committed); Type: smoke; Asserts: every one of the 13 `brand.colors` equals `plugins/oncue/engine/examples/gleaner/short.json`, and `check` accepts the spec; Run: in `plugins/oncue/engine`, `node -e "const r=require('path').resolve,a=require(r(process.argv[1])).brand.colors,b=require(r('examples/gleaner/short.json')).brand.colors,bad=Object.keys(b).filter(k=>a[k]!==b[k]);if(bad.length){console.error('differs:',bad.join(', '));process.exit(1)}" <scratch>/short.json && node dist/cli.js check <scratch>/short.json`

## Acceptance Criteria

- [x] With no look given and no design files in the project, the storyboard skill lists the person's Design System artifacts and asks which to use, because none is marked default.
- [x] The bundled Gleaner sample is never offered or reused as an earlier Short, whether it sits at `oncue-engine/examples/gleaner/short.json` (setup skill) or `plugins/oncue/engine/examples/gleaner/short.json` (a clone of this repo).
- [x] Picking the Gleaner Design System gives a `short.json` whose 13 `brand.colors` equal the Gleaner example's, and `check` prints no contrast warning.
- [x] The logo taken from that Design System is a square PNG, and `stills` renders it.
- [x] Asking for "make it light" and then picking the Gleaner Design System gives its light values (`ground` is `#f5f8f6`), not an invented palette.
- [x] A second Short in the same project has `brand` and `theme` identical to the first's, and a byte-identical logo file at the path its `brand.logo` resolves to, including a subfolder path such as `assets/logo.png`.
- [x] Choosing "none of these" for every hit leads to the fallback look, not a forced pick.
- [x] When the look came from no saved source, the skill offers a DESIGN.md after the stills are approved, writes it at the project root only on a yes, and never overwrites an existing one.
- [x] A Short started from only that DESIGN.md gets the same colours, fonts, deck fonts, `radius`, `density`, `type` and `background` as the Short that saved it.
- [x] `grep -c "installed design system's" plugins/oncue/skills/storyboard/references/theme.md` prints 0.
- [x] `plugin.json` says 1.7.0, the README has a 1.7.0 changelog entry, and `npm run validate` exits 0.

## Completion Report

- Not exercised by any run — a Design System marked as default, because this account has none; the session with no Artifact tool; and "go ahead without stopping". The text for all three is in theme.md, and none is a check in this plan.
- "Never overwrites" shown indirectly — Run C3 left an existing DESIGN.md byte-identical, and the skill only offers to save when the project has none. No run tried to save over one.

## Verification

Run the storyboard skill in scratch project folders, with no look given. Set each one up the way the setup skill does, by copying this repo's engine in as `oncue-engine/` (`cp -R plugins/oncue/engine <folder>/oncue-engine`, then `npm install` inside it), so the bundled Gleaner sample sits in the project just as it does in real use. Run the engine commands below from that folder's `oncue-engine/`.

**Run A, using a Design System:** in a fresh project folder, ask for a Short about Gleaner. The skill should not offer `oncue-engine/examples/gleaner/short.json` as an earlier Short. Instead it should list the person's Design Systems (Astro Kit, Gleaner, OnCue and Salt Tampa on 2026-10-30) and ask which to use. Pick Gleaner. The objective test's Run command should exit 0, `check` should print no contrast warning, and `node dist/cli.js stills <A>/short.json` should render the PNG logo taken from the Design System. Repeat in another fresh project folder, asking for "make it light": `brand.colors.ground` should be `#f5f8f6`, the Gleaner Design System's light `g-ground`.

**Run B, reusing a look:** keep Run A's folder as the project folder and ask for a second Short in a new subfolder, so both Shorts sit under the same search root. The skill should name Run A's Short and copy its look without listing the Design Systems. Before Run B, move Run A's logo to `<A>/assets/logo.png` and set its `brand.logo` to `assets/logo.png`, so Run B also proves the logo lands at `<B>/assets/logo.png` and `stills` renders it. Comparing the two specs' `brand` and `theme` with `node:assert`'s `deepStrictEqual` should pass, and `cmp` on the two logo files should exit 0.

**Run C, creating a look:** in another fresh project folder, choose "none of these" for the Design Systems, ask for "light, playful", and approve the stills. The skill should offer to save a DESIGN.md. Answering no should leave no file (`test ! -f <C>/DESIGN.md`). A rerun in `<C>` would find that run's Short and rightly skip the offer, so repeat Run C in a new fresh project folder `<C2>` and answer yes: it should write `<C2>/DESIGN.md` with an `oncue:` block. Then copy only that DESIGN.md into a new project folder (with its own engine copy) and storyboard a Short there. Its `brand.colors`, `fonts`, `deckFonts` and `theme` (`radius`, `density`, `type`, `background`) should equal Run C2's.

**Run D, a clone of this repo:** with this repo's checkout as the project folder, ask for a Short about OnCue. The skill should not offer `plugins/oncue/engine/examples/gleaner/short.json` as an earlier Short.

Last, `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0. The engine is untouched, so `npm run example:stills` output should match main's.

## Next Steps

- Let short.json point at a shared look file
  Keeps every Short of a brand in step by editing one file, instead of copying the look into each Short.
  ```text
  In the oncue repo, add an optional `look` field to short.json in plugins/oncue/engine: a path, relative to short.json, to a JSON file holding `brand` and `theme`. loadSpec in src/spec.ts merges the file in before validation, with keys in short.json winning, resolves brand.logo relative to the look file, and names `look` in its errors. Add the type to src/spec.ts, a row to plugins/oncue/skills/storyboard/references/spec.md, and tests in plugins/oncue/engine/test/. Rebuild dist with `npm run build` in the engine folder. Point theme.md's "An earlier Short" section at the look file. Bump the minor version in plugins/oncue/.claude-plugin/plugin.json and add a changelog entry at the end of README.md. Verify: `npm run validate`, `npm run engine:typecheck` and `npm run engine:test` exit 0, and the Gleaner example's stills are byte-identical with its brand moved into a look file.
  ```

## Resources

- Gleaner Design System artifact, https://claude.ai/artifact/WcTU2zAmooxWeVPCmQCXFm — the `project/tokens.json` format and the 13 role matches in Context.
- Astro Kit Design System artifact, https://claude.ai/artifact/HKxyaqURmUX9WE4G8TiiW4 — a second example of the format, built from a DESIGN.md.
- The design-system-from-design-md skill — the DESIGN.md frontmatter shape (`colors`, `typography`, `rounded`, `spacing`) it turns into a Design System.
- docs/plans/enable-user-driven-board-design.md — the 1.4.0 plan that added `theme` and `references/theme.md`.
