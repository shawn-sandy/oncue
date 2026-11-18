"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNarration = formatNarration;
exports.parseNarration = parseNarration;
exports.readNarration = readNarration;
exports.writeNarration = writeNarration;
exports.reminderHint = reminderHint;
exports.hardWords = hardWords;
exports.narrationReport = narrationReport;
/**
 * narration.md: one section per slide and an approval flag. Speaker notes are used as written, a slide without notes
 * gets a drafted line, and nothing is recorded until the person sets `approved: true`.
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const assemble_1 = require("./assemble");
const slides_1 = require("./slides");
const timeline_1 = require("./timeline");
const FILE = "narration.md";
const flat = (s) => s.replace(/\s+/g, " ").trim();
/** The first draft of narration.md: notes filled in, slides without notes marked `none` with their text as a hint. */
function formatNarration(slides) {
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
  (none)     no narration: the slide is held in silence for ${assemble_1.DWELL} seconds
To narrate a (none) slide, write its line under the heading and change the marker to (drafted).
Nothing is recorded until the first lines of this file say approved: true.
-->

${sections.join("\n")}`;
}
function parseNarration(md) {
    const front = /^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? "";
    const parts = (0, slides_1.strip)(md, /<!--[\s\S]*?-->/g).split(/^## Slide (\d+) \((notes|drafted|none)\)[ \t]*$/m);
    const lines = [];
    for (let i = 1; i + 2 < parts.length + 1; i += 3)
        lines.push({ n: Number(parts[i]), source: parts[i + 1], vo: flat(parts[i + 2] ?? "") });
    return { approved: /^approved:\s*true\s*$/m.test(front), lines };
}
/** Reads and checks narration.md against the imported slides, so a mistyped heading or marker is caught before recording. */
function readNarration(dir) {
    const file = (0, node_path_1.join)(dir, FILE);
    if (!(0, node_fs_1.existsSync)(file))
        throw new Error(`No ${FILE} in ${dir}. Run import first.`);
    const narration = parseNarration((0, node_fs_1.readFileSync)(file, "utf8"));
    const slides = (0, slides_1.readSlides)(dir);
    const got = narration.lines.map((l) => l.n).join(","), want = slides.map((s) => s.n).join(",");
    if (got !== want)
        throw new Error(`${FILE} has ${narration.lines.length} slide sections (${got || "none"}) but the deck has ${slides.length} slides. Each needs a heading like "## Slide 2 (drafted)", in order; to start over, delete ${FILE} and import again.`);
    for (const l of narration.lines) {
        if (l.source === "none" && l.vo)
            throw new Error(`Slide ${l.n} is marked (none) but has text. Change its marker to (drafted), or remove the text.`);
        if (l.source !== "none" && !l.vo)
            throw new Error(`Slide ${l.n} is marked (${l.source}) but has no text. Write its line, or change the marker to (none).`);
    }
    return narration;
}
function writeNarration(dir, slides) {
    const file = (0, node_path_1.join)(dir, FILE);
    if ((0, node_fs_1.existsSync)(file))
        return false;
    (0, node_fs_1.writeFileSync)(file, formatNarration(slides));
    return true;
}
/**
 * Notes written for the presenter rather than to be spoken: a line ending in a colon ("Open with the problem in one
 * line:"), a leading label ("Personal anecdote: ..."), or a bracketed stage direction ("[pause]", "(click)").
 * A hint for the person to judge, not a verdict: plenty of real narration has a colon in it.
 */
// ponytail: three surface patterns, not a classifier; the skill also has the model read every note before approval.
function reminderHint(notes) {
    for (const line of notes.split("\n").map((l) => l.trim()).filter(Boolean)) {
        if (/:$/.test(line))
            return line;
        const label = /^[A-Z][\w' -]{0,30}:\s/.exec(line);
        if (label)
            return label[0].trim();
        const cue = /\[[^\]]+\]|\((?:pause|click|beat|demo|next slide|advance)[^)]*\)/i.exec(line);
        if (cue)
            return cue[0];
    }
    return null;
}
/** Words a voice is likely to read wrongly: commands, placeholders, prices, K/M amounts, web addresses, flags and code names. */
const HARD = [
    /(?<=^|\s)\/[\w-]+/g, // /triage-stats
    /\b[A-Z]{2,}(?:-[A-Z]{2,})+\b/g, // YYYY-MM-DD
    /\$\d[\d,.]*/g, // $0.00014
    /\b\d+(?:\.\d+)?[KMB]\b/g, // 200K, 1M
    /\b(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|dev|ai|app|co)\b[^\s]*/g, // example.com
    /(?<=^|\s)--?[a-z][\w-]*/g, // --verbose, -v
    /\b[A-Za-z0-9]+_[\w]+\b/g, // my_config
    /`[^`]+`|[{}<>|\\]/g, // code and stray symbols
];
function hardWords(vo) {
    const found = HARD.flatMap((re) => vo.match(re) ?? []).map((w) => w.replace(/[.,;:!?)]+$/, ""));
    return [...new Set(found.filter(Boolean))];
}
const list = (ns) => `slide${ns.length > 1 ? "s" : ""} ${ns.join(", ")}`;
/**
 * What `narration` prints: the script of each recording, then the silent slides and a length and credit estimate.
 * Also writes recording-plan.json. Warnings cover slides the split cannot place and notes that no longer match the deck.
 */
function narrationReport(dir) {
    const { approved, lines } = readNarration(dir);
    const { runs, silent, warnings } = (0, timeline_1.planSlides)(lines);
    const notes = new Map((0, slides_1.readSlides)(dir).map((s) => [s.n, s.notes]));
    for (const l of lines) {
        if (l.source === "notes" && l.vo !== flat(notes.get(l.n) ?? ""))
            warnings.push(`slide ${l.n} is marked (notes) but its text differs from the deck's speaker notes; restore them, or mark it (drafted) if the change is meant.`);
        const hint = l.source === "notes" ? reminderHint(notes.get(l.n) ?? "") : null;
        if (hint)
            warnings.push(`slide ${l.n}'s notes look like a reminder to the presenter ("${hint}"), not lines to speak; ask the person whether to draft spoken lines for it instead, marked (drafted).`);
        const hard = hardWords(l.vo);
        if (hard.length)
            warnings.push(`slide ${l.n} has words a voice may read wrongly: ${hard.map((w) => `"${w}"`).join(", ")}; write them as they should be heard, for example "two hundred thousand" for 200K, if the person agrees.`);
    }
    const name = (k, stem, ext) => `${stem}-${String(k + 1).padStart(2, "0")}.${ext}`;
    const plan = { dwell: assemble_1.DWELL, silent, runs: runs.map((r, k) => ({ run: k + 1, ...r, audio: name(k, "voiceover", "mp3"), words: name(k, "words", "json") })) };
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(dir, "recording-plan.json"), JSON.stringify(plan, null, 2));
    const out = [];
    for (const r of plan.runs)
        out.push(`--- recording ${r.run} of ${plan.runs.length}: ${list(r.slides)}${r.kind === "clip" ? " (its own clip)" : ""} → ${r.audio}, ${r.words} ---`, "", r.script, "");
    if (!plan.runs.length)
        out.push("No narration yet: every slide is marked (none).", "");
    if (silent.length)
        out.push(`${list(silent)} ${silent.length > 1 ? "have" : "has"} no narration and will be held in silence for ${assemble_1.DWELL}s each.`);
    const seconds = (0, timeline_1.estimateWords)({ lines }).seconds;
    // The only measured figures the project has: one 75-second read cost about 1,100 credits a take and 600 to transcribe.
    if (plan.runs.length)
        out.push(`About ${Math.round(seconds)}s of narration in ${plan.runs.length} recording${plan.runs.length > 1 ? "s" : ""}.`, `Rough estimate only, scaled from one reference read: about ${Math.round((seconds / 75) * 1100)} credits per take to generate and ${Math.round((seconds / 75) * 600)} per take to transcribe.`);
    return { approved, out, warnings };
}
