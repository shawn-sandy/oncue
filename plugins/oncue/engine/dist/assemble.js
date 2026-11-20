"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioSeconds = exports.FADE = exports.DWELL = void 0;
exports.layout = layout;
exports.xfadeKind = xfadeKind;
exports.fadePlan = fadePlan;
exports.joinFilters = joinFilters;
exports.assemble = assemble;
/** Stitches a deck's page pictures and its recorded narration into an MP4 with ffmpeg. No browser is involved. */
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const sharp_1 = __importDefault(require("sharp"));
const narration_1 = require("./narration");
const slides_1 = require("./slides");
const timeline_1 = require("./timeline");
/** Seconds a slide with no narration stays on screen. */
exports.DWELL = 4;
const FPS = 30;
/** Seconds each slide change fades over, centred on the cut. 0 keeps hard cuts. */
exports.FADE = 0.5;
const audioSeconds = (file) => Number((0, node_child_process_1.execFileSync)("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
exports.audioSeconds = audioSeconds;
/**
 * Lays slides out in order. A narrated slide plays its span of its recording; a slide with no span is held for DWELL in
 * silence, which cuts the recording at that boundary. The first slide also holds the lead, the last the tail.
 */
function layout(order, spans) {
    const video = [];
    const audio = [{ from: 0, to: timeline_1.LEAD }];
    for (const n of order) {
        const span = spans.get(n);
        video.push({ n, seconds: span ? span.end - span.start : exports.DWELL });
        const last = audio.at(-1);
        if (!span)
            audio.push({ from: 0, to: exports.DWELL });
        else if (last.run === span.run && last.to === span.start)
            last.to = span.end;
        else
            audio.push({ run: span.run, from: span.start, to: span.end });
    }
    audio.push({ from: 0, to: timeline_1.TAIL });
    if (video.length) {
        video[0].seconds += timeline_1.LEAD;
        video.at(-1).seconds += timeline_1.TAIL;
    }
    return { video, audio, duration: video.reduce((t, v) => t + v.seconds, 0) };
}
const SIDES = { l: "left", r: "right", u: "up", d: "down" };
/**
 * The ffmpeg `xfade` transition for a slide's own: a push slides, a wipe wipes, each in its direction (left when the deck
 * gives none); every other kind, or none, is a plain fade. The length is always `--fade`, not the deck's speed.
 */
function xfadeKind(t) {
    const side = SIDES[t?.dir ?? "l"] ?? "left";
    return t?.kind === "push" ? `slide${side}` : t?.kind === "wipe" ? `wipe${side}` : "fade";
}
/**
 * Whole frames per still and, per slide change, where its fade starts and how long it is, on the output timeline.
 * Cut frames come from the running total, so rounding never drifts the picture away from the sound. Each fade is
 * centred on its cut and shortened so the two fades of a short slide never meet; a slide too short for any fade gets cuts. Every still is held half a fade
 * longer on each faded side, so the joined video is exactly as long as with hard cuts.
 */
function fadePlan(video, fade, fps) {
    const cuts = [], base = [];
    let t = 0, frame = 0;
    for (const v of video) {
        t += v.seconds;
        const frames = Math.max(1, Math.round(t * fps) - frame);
        frame += frames;
        base.push(frames);
        cuts.push(frame);
    }
    const full = Math.round(fade * fps), lead = Math.floor(full / 2);
    // Both sides share the shorter neighbour's limit, so a shortened fade stays centred; 0 means that change is a cut.
    const parts = base.slice(1).map((b, i) => {
        const room = Math.min(Math.floor(base[i] / 2), Math.floor(b / 2));
        return { before: Math.min(lead, room), after: Math.min(full - lead, room) };
    });
    return {
        frames: base.map((b, i) => b + (parts[i - 1]?.before ?? 0) + (parts[i]?.after ?? 0)),
        fades: parts.map((p, i) => ({ start: cuts[i] - p.before, frames: p.before + p.after })),
    };
}
/**
 * Joins stills `[v0]`…`[vN]` into `[v]`: an `xfade` of `kinds[i]` at each planned fade, or a `concat` where a fade has no
 * frames. `xfade` with a zero duration never starts when the stream before it is already over, which shifts every later
 * slide, so a cut must stay a cut.
 */
function joinFilters(fades, kinds, fps) {
    return fades.map((f, i) => {
        const a = i ? `[x${i}]` : "[v0]", b = `[v${i + 1}]`, out = i === fades.length - 1 ? "[v]" : `[x${i + 1}]`;
        return f.frames > 0
            ? `${a}${b}xfade=transition=${kinds[i] ?? "fade"}:duration=${(f.frames / fps).toFixed(4)}:offset=${(f.start / fps).toFixed(4)}${out}`
            : `${a}${b}concat=n=2:v=1:a=0${out}`;
    });
}
/**
 * Writes `<dir>/deck.mp4`, or `preview-silent.mp4` with estimated timing when nothing has been recorded yet.
 * The picture keeps the deck's own shape, scaled to fit 1920×1080 with even sides.
 */
async function assemble(dir, out, fade = exports.FADE) {
    const slides = (0, slides_1.readSlides)(dir);
    const { lines } = (0, narration_1.readNarration)(dir);
    const { runs } = (0, timeline_1.planSlides)(lines);
    const vo = new Map(lines.map((l) => [l.n, l.vo]));
    // One recording may be saved under the voiceover skill's plain names.
    const files = runs.map((_, k) => {
        const nn = String(k + 1).padStart(2, "0");
        const plain = runs.length === 1 && !(0, node_fs_1.existsSync)((0, node_path_1.join)(dir, `voiceover-${nn}.mp3`));
        return { audio: (0, node_path_1.join)(dir, plain ? "voiceover.mp3" : `voiceover-${nn}.mp3`), words: (0, node_path_1.join)(dir, plain ? "words.json" : `words-${nn}.json`) };
    });
    const absent = files.flatMap((f) => [f.audio, f.words]).filter((f) => !(0, node_fs_1.existsSync)(f));
    const silent = absent.length === files.length * 2;
    if (absent.length && !silent)
        throw new Error(`Some recordings are missing: ${absent.join(", ")}. Record every take in recording-plan.json, or remove them all for a silent preview.`);
    const spans = new Map();
    runs.forEach((r, k) => {
        const script = r.slides.map((n) => ({ n, vo: vo.get(n) }));
        const est = silent ? (0, timeline_1.estimateWords)({ lines: script }) : null;
        const timed = (0, timeline_1.buildSlideTimeline)(script, est ? est.words : (0, timeline_1.readWords)(files[k].words), est ? est.seconds : (0, exports.audioSeconds)(files[k].audio));
        for (const s of timed)
            spans.set(s.n, { run: k, start: s.start, end: s.end });
    });
    const plan = layout(slides.map((s) => s.n), spans);
    const first = await (0, sharp_1.default)((0, node_path_1.join)(dir, slides[0].page)).metadata();
    const scale = Math.min(1920 / first.width, 1080 / first.height);
    const even = (px) => Math.max(2, Math.round((px * scale) / 2) * 2);
    const [w, h] = [even(first.width), even(first.height)];
    // Joined by `concat` (hard cuts) or a chain of `xfade`s at the planned offsets, which keeps the same length.
    const timing = fadePlan(plan.video, fade, FPS);
    const faded = timing.fades.some((f) => f.frames > 0);
    const inputs = [], filters = [];
    timing.frames.forEach((frames, i) => {
        inputs.push("-framerate", String(FPS), "-loop", "1", "-t", ((frames + 1) / FPS).toFixed(3), "-i", (0, node_path_1.join)(dir, slides[i].page));
        filters.push(`[${i}:v]trim=end_frame=${frames},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`);
    });
    if (!faded)
        filters.push(`${plan.video.map((_, i) => `[v${i}]`).join("")}concat=n=${plan.video.length}:v=1:a=0[v]`);
    else if (timing.frames.length === 1)
        filters.push("[v0]null[v]");
    else
        filters.push(...joinFilters(timing.fades, slides.slice(1).map((s) => xfadeKind(s.transition)), FPS));
    const pieces = silent ? [{ from: 0, to: plan.duration }] : plan.audio;
    let input = plan.video.length;
    pieces.forEach((p, j) => {
        const length = (p.to - p.from).toFixed(3);
        if (p.run === undefined) {
            filters.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${length}[a${j}]`);
            return;
        }
        inputs.push("-ss", p.from.toFixed(3), "-t", length, "-i", files[p.run].audio);
        filters.push(`[${input++}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${j}]`);
    });
    filters.push(`${pieces.map((_, j) => `[a${j}]`).join("")}concat=n=${pieces.length}:v=0:a=1[a]`);
    const file = (0, node_path_1.resolve)(out ?? (0, node_path_1.join)(dir, silent ? "preview-silent.mp4" : "deck.mp4"));
    (0, node_child_process_1.execFileSync)("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", String(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", file,
    ], { stdio: ["ignore", "inherit", "inherit"] });
    console.log(`wrote ${file}: ${plan.video.length} slides, ${plan.duration.toFixed(1)}s, ${w}×${h}${silent ? ", silent preview with estimated timing" : ""}`);
    return file;
}
