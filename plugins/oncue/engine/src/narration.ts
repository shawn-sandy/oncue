/**
 * narration.md: one section per slide and an approval flag. Speaker notes are used as written, a slide without notes
 * gets a drafted line, and nothing is recorded until the person sets `approved: true`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DWELL } from "./assemble";
import { readSlides, strip, type Slide } from "./slides";
import { estimateWords, planSlides, type Run, type SlideLine, type Source } from "./timeline";

export interface Narration { approved: boolean; lines: SlideLine[] }
/** recording-plan.json: what to record, in order, and the file names assemble looks for. */
export interface RecordingPlan { dwell: number; silent: number[]; runs: (Run & { run: number; audio: string; words: string })[] }

const FILE = "narration.md";
const flat = (s: string): string => s.replace(/\s+/g, " ").trim();

/** The first draft of narration.md: notes filled in, slides without notes marked `none` with their text as a hint. */
export function formatNarration(slides: Slide[]): string {
  const sections = slides.map((s) => {
    const notes = s.notes.split("\n").filter(Boolean).join("\n\n");
    const hint = s.text ? `<!-- On this slide: ${flat(s.text).replace(/--+/g, "-")} -->` : "<!-- No text was read from this slide; look at its page picture. -->";
    return notes ? `## Slide ${s.n} (notes)\n\n${notes}\n` : `## Slide ${s.n} (none)\n\n${hint}\n`;
  });
  return `---
approved: false
---

# Narration

<!--
One section per slide, in order. The marker after the slide number says where the line came from:
  (notes)    the deck's own speaker notes, used as written
  (drafted)  a line written for a slide that had no notes
  (none)     no narration: the slide is held in silence for ${DWELL} seconds
To narrate a (none) slide, write its line under the heading and change the marker to (drafted).
Nothing is recorded until the first lines of this file say approved: true.
-->

${sections.join("\n")}`;
}

export function parseNarration(md: string): Narration {
  const front = /^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? "";
  const parts = strip(md, /<!--[\s\S]*?-->/g).split(/^## Slide (\d+) \((notes|drafted|none)\)[ \t]*$/m);
  const lines: SlideLine[] = [];
  for (let i = 1; i + 2 < parts.length + 1; i += 3) lines.push({ n: Number(parts[i]), source: parts[i + 1] as Source, vo: flat(parts[i + 2] ?? "") });
  return { approved: /^approved:\s*true\s*$/m.test(front), lines };
}

/** Reads and checks narration.md against the imported slides, so a mistyped heading or marker is caught before recording. */
export function readNarration(dir: string): Narration {
  const file = join(dir, FILE);
  if (!existsSync(file)) throw new Error(`No ${FILE} in ${dir}. Run import first.`);
  const narration = parseNarration(readFileSync(file, "utf8"));
  const slides = readSlides(dir);
  const got = narration.lines.map((l) => l.n).join(","), want = slides.map((s) => s.n).join(",");
  if (got !== want)
    throw new Error(`${FILE} has ${narration.lines.length} slide sections (${got || "none"}) but the deck has ${slides.length} slides. Each needs a heading like "## Slide 2 (drafted)", in order; to start over, delete ${FILE} and import again.`);
  for (const l of narration.lines) {
    if (l.source === "none" && l.vo) throw new Error(`Slide ${l.n} is marked (none) but has text. Change its marker to (drafted), or remove the text.`);
    if (l.source !== "none" && !l.vo) throw new Error(`Slide ${l.n} is marked (${l.source}) but has no text. Write its line, or change the marker to (none).`);
  }
  return narration;
}

export function writeNarration(dir: string, slides: Slide[]): boolean {
  const file = join(dir, FILE);
  if (existsSync(file)) return false;
  writeFileSync(file, formatNarration(slides));
  return true;
}

/**
 * Notes written for the presenter rather than to be spoken: a line ending in a colon ("Open with the problem in one
 * line:"), a leading label ("Personal anecdote: ..."), or a bracketed stage direction ("[pause]", "(click)").
 * A hint for the person to judge, not a verdict: plenty of real narration has a colon in it.
 */
// ponytail: three surface patterns, not a classifier; the skill also has the model read every note before approval.
export function reminderHint(notes: string): string | null {
  for (const line of notes.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/:$/.test(line)) return line;
    const label = /^[A-Z][\w' -]{0,30}:\s/.exec(line);
    if (label) return label[0].trim();
    const cue = /\[[^\]]+\]|\((?:pause|click|beat|demo|next slide|advance)[^)]*\)/i.exec(line);
    if (cue) return cue[0];
  }
  return null;
}

/** Words a voice is likely to read wrongly: commands, placeholders, prices, K/M amounts, web addresses, flags and code names. */
const HARD = [
  /(?<=^|\s)\/[\w-]+/g,                     // /triage-stats
  /\b[A-Z]{2,}(?:-[A-Z]{2,})+\b/g,           // YYYY-MM-DD
  /\$\d[\d,.]*/g,                           // $0.00014
  /\b\d+(?:\.\d+)?[KMB]\b/g,                // 200K, 1M
  /\b(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|dev|ai|app|co)\b[^\s]*/g, // example.com
  /(?<=^|\s)--?[a-z][\w-]*/g,                // --verbose, -v
  /\b[A-Za-z0-9]+_[\w]+\b/g,                 // my_config
  /`[^`]+`|[{}<>|\\]/g,                     // code and stray symbols
];
export function hardWords(vo: string): string[] {
  const found = HARD.flatMap((re) => vo.match(re) ?? []).map((w) => w.replace(/[.,;:!?)]+$/, ""));
  return [...new Set(found.filter(Boolean))];
}

const list = (ns: number[]): string => `slide${ns.length > 1 ? "s" : ""} ${ns.join(", ")}`;

/**
 * What `narration` prints: the script of each recording, then the silent slides and a length and credit estimate.
 * Also writes recording-plan.json. Warnings cover slides the split cannot place and notes that no longer match the deck.
 */
export function narrationReport(dir: string): { approved: boolean; out: string[]; warnings: string[] } {
  const { approved, lines } = readNarration(dir);
  const { runs, silent, warnings } = planSlides(lines);
  const notes = new Map(readSlides(dir).map((s) => [s.n, s.notes]));
  for (const l of lines) {
    if (l.source === "notes" && l.vo !== flat(notes.get(l.n) ?? "")) warnings.push(`slide ${l.n} is marked (notes) but its text differs from the deck's speaker notes; restore them, or mark it (drafted) if the change is meant.`);
    const hint = l.source === "notes" ? reminderHint(notes.get(l.n) ?? "") : null;
    if (hint) warnings.push(`slide ${l.n}'s notes look like a reminder to the presenter ("${hint}"), not lines to speak; ask the person whether to draft spoken lines for it instead, marked (drafted).`);
    const hard = hardWords(l.vo);
    if (hard.length) warnings.push(`slide ${l.n} has words a voice may read wrongly: ${hard.map((w) => `"${w}"`).join(", ")}; write them as they should be heard, for example "two hundred thousand" for 200K, if the person agrees.`);
  }

  const name = (k: number, stem: string, ext: string): string => `${stem}-${String(k + 1).padStart(2, "0")}.${ext}`;
  const plan: RecordingPlan = { dwell: DWELL, silent, runs: runs.map((r, k) => ({ run: k + 1, ...r, audio: name(k, "voiceover", "mp3"), words: name(k, "words", "json") })) };
  writeFileSync(join(dir, "recording-plan.json"), JSON.stringify(plan, null, 2));

  const out: string[] = [];
  for (const r of plan.runs) out.push(`--- recording ${r.run} of ${plan.runs.length}: ${list(r.slides)}${r.kind === "clip" ? " (its own clip)" : ""} → ${r.audio}, ${r.words} ---`, "", r.script, "");
  if (!plan.runs.length) out.push("No narration yet: every slide is marked (none).", "");
  if (silent.length) out.push(`${list(silent)} ${silent.length > 1 ? "have" : "has"} no narration and will be held in silence for ${DWELL}s each.`);
  const seconds = estimateWords({ lines }).seconds;
  // The only measured figures the project has: one 75-second read cost about 1,100 credits a take and 600 to transcribe.
  if (plan.runs.length) out.push(
    `About ${Math.round(seconds)}s of narration in ${plan.runs.length} recording${plan.runs.length > 1 ? "s" : ""}.`,
    `Rough estimate only, scaled from one reference read: about ${Math.round((seconds / 75) * 1100)} credits per take to generate and ${Math.round((seconds / 75) * 600)} per take to transcribe.`,
  );
  return { approved, out, warnings };
}
