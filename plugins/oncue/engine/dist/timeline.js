"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAIL = exports.LEAD = void 0;
exports.readWords = readWords;
exports.estimateWords = estimateWords;
exports.splitWarnings = splitWarnings;
exports.buildTimeline = buildTimeline;
/**
 * Turns short.json + a word-timestamped transcript into timeline.json:
 * when each scene starts and when each animated slot enters.
 */
const node_fs_1 = require("node:fs");
const cues_1 = require("./cues");
exports.LEAD = 0.3;
exports.TAIL = 1.6;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Accepts ElevenLabs Scribe output ({ words: [...] }) or a bare array of { text, start, end }. */
function readWords(file) {
    const raw = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.words ?? [];
    return list.filter((w) => (w.type ?? "word") === "word" && Number.isFinite(w.start));
}
/**
 * Estimated word timings from the script alone (about 15 characters a second with sentence pauses),
 * for a silent preview before any voiceover exists.
 */
function estimateWords(spec) {
    const words = [];
    let t = 0;
    for (const line of spec.lines) {
        for (const text of line.vo.split(/\s+/).filter(Boolean)) {
            const d = Math.max(0.16, text.replace(/[^A-Za-z0-9]/g, "").length / 15);
            words.push({ text, start: t, end: t + d });
            t += d + (/[.?!]["”']?$/.test(text) ? 0.45 : /[,;:]$/.test(text) ? 0.22 : 0.06);
        }
    }
    return { words, seconds: t };
}
/**
 * Splits the transcript at the first word of each line, which must begin a sentence; returns those word indexes.
 * Stops at the first line it cannot find, so a short result means that line is missing.
 */
function lineStarts(spec, words) {
    const starts = [];
    let from = 0;
    for (const line of spec.lines) {
        const first = norm(line.vo.split(/\s+/)[0] ?? "");
        const ok = (k) => k >= from && norm(words[k].text) === first && (k === 0 || /[.?!]["”']?$/.test(words[k - 1].text));
        let i = words.findIndex((_, k) => ok(k));
        if (i < 0)
            i = words.findIndex((w, k) => k >= from && norm(w.text) === first);
        if (i < 0)
            break;
        starts.push(i);
        from = i + 1;
    }
    return starts;
}
/**
 * One warning per beat the split would start inside an earlier beat, found by running the split on the script itself:
 * only a sentence the split can still reach matters, not every repeat of the word. A warning, not an error, because a
 * transcript punctuated differently may still place the beat. A line it cannot find at all is left for stills to report.
 */
function splitWarnings(spec) {
    const starts = lineStarts(spec, estimateWords(spec).words);
    const beatOf = spec.lines.flatMap((l, b) => l.vo.split(/\s+/).filter(Boolean).map(() => b));
    return starts.flatMap((word, b) => {
        const host = beatOf[word];
        if (host >= b)
            return [];
        const first = spec.lines[b].vo.split(/\s+/)[0];
        return [`beat ${b + 1}'s first word "${first}" is also heard inside beat ${host + 1}, so beat ${b + 1} may start there, too early; reword one of them.`];
    });
}
function buildTimeline(spec, words, audioSeconds) {
    const warnings = [];
    const starts = lineStarts(spec, words);
    const li = starts.length, missing = spec.lines[li];
    if (missing)
        throw new Error(`Line ${li + 1} ("${missing.vo.slice(0, 40)}…") not found in the transcript. Re-transcribe, or make lines[${li}].vo match what was said.`);
    const duration = audioSeconds + exports.LEAD + exports.TAIL;
    const scenes = starts.map((wi, s) => {
        const endIdx = s + 1 < starts.length ? starts[s + 1] : words.length;
        const lineWords = words.slice(wi, endIdx);
        const first = words[wi];
        const start = s === 0 ? 0 : exports.LEAD + (words[wi - 1].end + first.start) / 2;
        const lineStart = exports.LEAD + first.start;
        const lineEnd = exports.LEAD + (lineWords.at(-1)?.end ?? first.end);
        const cues = { line: lineStart };
        const list = (0, cues_1.slots)(spec.lines[s].scene);
        list.forEach((slot, k) => {
            if (slot.cue) {
                const want = norm(slot.cue.word);
                const hits = lineWords.filter((w) => norm(w.text).startsWith(want));
                const hit = hits[(slot.cue.nth ?? 1) - 1];
                if (hit) {
                    cues[slot.id] = exports.LEAD + hit.start + (slot.cue.offset ?? 0);
                    return;
                }
                warnings.push(`scene ${s + 1} ${slot.id}: cue word "${slot.cue.word}" not heard in this line; spacing it evenly instead`);
            }
            // No cue (or not found): spread the slots evenly across the line.
            cues[slot.id] = lineStart + ((k + 0.5) / list.length) * Math.max(0.6, lineEnd - lineStart);
        });
        return { start, end: duration, cues };
    });
    scenes.forEach((sc, i) => { if (i + 1 < scenes.length)
        sc.end = scenes[i + 1].start; });
    return { lead: exports.LEAD, tail: exports.TAIL, duration, scenes, warnings };
}
