/** Steps the scenes page frame by frame in headless Chromium and encodes the frames with ffmpeg. */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import type { Timeline } from "./timeline";

interface RenderWindow { renderAt: (t: number) => void; ready?: boolean; FIT?: Fit[] }
export interface Size { width: number; height: number }
/** The fit guard's result per scene (render.ts): scale < 1 means the scene was shrunk to fit its frame. */
export interface Fit { scene: number; scale: number; fits: boolean }

async function loadPlaywright(): Promise<typeof import("playwright")> {
  try { return await import("playwright"); } catch {
    throw new Error("Playwright is not installed. Run: npm install --save-dev playwright && npx playwright install chromium (in the engine folder).");
  }
}

async function open(scenesHtml: string, tl: Timeline, size: Size): Promise<{ page: Page; fit: Fit[]; close: () => Promise<void> }> {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(`window.TIMELINE = ${JSON.stringify(tl)};`);
  await page.goto("file://" + scenesHtml);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => (window as unknown as RenderWindow).ready === true, undefined, { timeout: 15000 })
    .catch(() => { throw new Error(`Scenes page failed to start: ${errors.join("; ") || "timed out"}`); });
  const fit = await page.evaluate(() => (window as unknown as RenderWindow).FIT ?? []);
  return { page, fit, close: () => browser.close() };
}

async function shot(page: Page, t: number, size: Size, type: "jpeg" | "png"): Promise<Buffer> {
  await page.evaluate((tt: number) => (window as unknown as RenderWindow).renderAt(tt), t);
  const clip = { x: 0, y: 0, ...size };
  return type === "jpeg" ? page.screenshot({ type: "jpeg", quality: 92, clip }) : page.screenshot({ type: "png", clip });
}

export async function renderVideo(scenesHtml: string, tl: Timeline, size: Size, out: string, audio: string | null, fps = 30): Promise<Fit[]> {
  const { page, fit, close } = await open(scenesHtml, tl, size);
  const frames = Math.ceil(tl.duration * fps);
  const audioArgs = audio ? ["-i", audio] : ["-f", "lavfi", "-t", tl.duration.toFixed(3), "-i", "anullsrc=r=44100:cl=mono"];
  const filter = audio ? `[0:v]format=yuv420p[v];[1:a]adelay=${Math.round(tl.lead * 1000)}:all=1,apad[a]` : "[0:v]format=yuv420p[v];[1:a]anull[a]";
  const ff = spawn("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    ...audioArgs, "-filter_complex", filter, "-map", "[v]", "-map", "[a]", "-t", tl.duration.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", String(fps),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise<void>((res, rej) => ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const buf = await shot(page, f / fps, size, "jpeg");
    if (!ff.stdin.write(buf)) await new Promise<void>((r) => ff.stdin.once("drain", () => r()));
    if (f % 300 === 0) console.log(`frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await done;
  await close();
  console.log(`wrote ${out}: ${frames} frames, ${tl.duration.toFixed(1)}s, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return fit;
}

export async function renderStills(scenesHtml: string, tl: Timeline, size: Size, dir: string, times: number[]): Promise<{ files: string[]; fit: Fit[] }> {
  const { page, fit, close } = await open(scenesHtml, tl, size);
  const files: string[] = [];
  for (const t of times) {
    const f = join(dir, `frame-${t.toFixed(2)}s.png`);
    writeFileSync(f, await shot(page, t, size, "png"));
    files.push(f);
  }
  await close();
  return { files, fit };
}
