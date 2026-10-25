"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVideo = renderVideo;
exports.renderStills = renderStills;
/** Steps the scenes page frame by frame in headless Chromium and encodes the frames with ffmpeg. */
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
async function loadPlaywright() {
    try {
        return await Promise.resolve().then(() => __importStar(require("playwright")));
    }
    catch {
        throw new Error("Playwright is not installed. Run: npm install playwright && npx playwright install chromium (in the engine folder).");
    }
}
async function open(scenesHtml, tl, size) {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(`window.TIMELINE = ${JSON.stringify(tl)};`);
    await page.goto("file://" + scenesHtml);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.ready === true, undefined, { timeout: 15000 })
        .catch(() => { throw new Error(`Scenes page failed to start: ${errors.join("; ") || "timed out"}`); });
    return { page, close: () => browser.close() };
}
async function shot(page, t, size, type) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    const clip = { x: 0, y: 0, ...size };
    return type === "jpeg" ? page.screenshot({ type: "jpeg", quality: 92, clip }) : page.screenshot({ type: "png", clip });
}
async function renderVideo(scenesHtml, tl, size, out, audio, fps = 30) {
    const { page, close } = await open(scenesHtml, tl, size);
    const frames = Math.ceil(tl.duration * fps);
    const audioArgs = audio ? ["-i", audio] : ["-f", "lavfi", "-t", tl.duration.toFixed(3), "-i", "anullsrc=r=44100:cl=mono"];
    const filter = audio ? `[0:v]format=yuv420p[v];[1:a]adelay=${Math.round(tl.lead * 1000)}:all=1,apad[a]` : "[0:v]format=yuv420p[v];[1:a]anull[a]";
    const ff = (0, node_child_process_1.spawn)("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
        ...audioArgs, "-filter_complex", filter, "-map", "[v]", "-map", "[a]", "-t", tl.duration.toFixed(3),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", String(fps),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out,
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((res, rej) => ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));
    const t0 = Date.now();
    for (let f = 0; f < frames; f++) {
        const buf = await shot(page, f / fps, size, "jpeg");
        if (!ff.stdin.write(buf))
            await new Promise((r) => ff.stdin.once("drain", () => r()));
        if (f % 300 === 0)
            console.log(`frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    await done;
    await close();
    console.log(`wrote ${out}: ${frames} frames, ${tl.duration.toFixed(1)}s, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
async function renderStills(scenesHtml, tl, size, dir, times) {
    const { page, close } = await open(scenesHtml, tl, size);
    const files = [];
    for (const t of times) {
        const f = (0, node_path_1.join)(dir, `frame-${t.toFixed(2)}s.png`);
        (0, node_fs_1.writeFileSync)(f, await shot(page, t, size, "png"));
        files.push(f);
    }
    await close();
    return files;
}
