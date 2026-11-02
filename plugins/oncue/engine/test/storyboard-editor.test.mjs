// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import engineSpec from "../dist/spec.js";
const editor = new URL(
  "../../skills/storyboard-editor/assets/editor.html",
  import.meta.url,
).href;
const example = JSON.parse(
  readFileSync(
    new URL("../examples/gleaner/short.json", import.meta.url),
    "utf8",
  ),
);
test("storyboard editor preserves specs, edits scenes and protects narration", async (t) => {
  let browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
  } catch (e) {
    t.skip(`Browser prerequisite: ${String(e).split("\n")[0]}`);
    return;
  }
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(editor);
    const original = structuredClone(example);
    original.custom = { keep: ["future", 42] };
    original.lines[0].scene.headline =
      '<img src=x onerror="window.injected=true">';
    await page.locator("#import").setInputFiles({
      name: "short.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(original)),
    });
    assert.equal(
      await page.locator("#beats button").count(),
      original.lines.length,
    );
    assert.equal(
      await page.getByLabel("Narration", { exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Move later", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(await page.locator("#preview img").count(), 0);
    const downloadSpec = async () => {
      const waiting = page.waitForEvent("download");
      await page.locator("#export").click();
      const download = await waiting;
      const path = await download.path();
      assert.ok(path);
      copyFileSync(
        new URL("../examples/gleaner/logo.png", import.meta.url),
        join(dirname(path), "logo.png"),
      );
      engineSpec.loadSpec(path);
      return JSON.parse(readFileSync(path, "utf8"));
    };
    assert.deepEqual(await downloadSpec(), original);
    for (let i = 0; i < original.lines.length; i++) {
      await page.locator("#beats button").nth(i).click();
      assert.equal(
        await page.getByLabel("scene / kind", { exact: true }).inputValue(),
        original.lines[i].scene.kind,
      );
    }
    await page.locator("#beats button").first().click();
    await page
      .getByLabel("scene / headline", { exact: true })
      .fill("A fresh storyboard");
    await page.locator("summary").click();
    await page
      .getByLabel("brand / colors / accent", { exact: true })
      .fill("#aabbcc");
    await page
      .getByLabel("theme / radius", { exact: true })
      .selectOption("sharp");
    await page.locator("#unlock").check();
    await page.getByRole("button", { name: "Move later", exact: true }).click();
    const edited = await downloadSpec();
    assert.equal(edited.lines[1].scene.headline, "A fresh storyboard");
    assert.equal(edited.lines[1].vo, original.lines[0].vo);
    assert.deepEqual(edited.custom, original.custom);
    assert.equal(edited.brand.colors.accent, "#aabbcc");
    assert.equal(edited.theme.radius, "sharp");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    assert.equal(
      (await downloadSpec()).lines.length,
      original.lines.length + 1,
    );
    await page.getByLabel("format / width", { exact: true }).fill("321");
    await page.locator("#export").click();
    assert.match(await page.locator("#status").innerText(), /Export failed/);
    await page.getByLabel("format / width", { exact: true }).fill("");
    assert.equal(await page.locator("#export").isDisabled(), true);
    await page.getByRole("button", { name: "Move later", exact: true }).click();
    assert.equal(
      await page.getByLabel("format / width", { exact: true }).inputValue(),
      "",
    );
    await page.getByLabel("format / width", { exact: true }).fill("1080");
    const imageSpec = structuredClone(example);
    imageSpec.lines = [
      {
        vo: "A local picture.",
        scene: {
          kind: "image",
          title: "Local picture",
          src: "logo.png",
          alt: "Logo",
        },
      },
    ];
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("#import").setInputFiles({
      name: "short.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imageSpec)),
    });
    await page.waitForFunction(
      () => document.querySelector("#unlock").checked === false,
    );
    assert.equal(
      await page.getByLabel("Narration", { exact: true }).isDisabled(),
      true,
    );
    await page
      .locator("#pictures")
      .setInputFiles(
        new URL("../examples/gleaner/logo.png", import.meta.url).pathname,
      );
    assert.equal(
      await page.locator("#preview img").getAttribute("alt"),
      "Logo",
    );
    assert.deepEqual(await downloadSpec(), imageSpec);
    await page.locator("#import").setInputFiles({
      name: "short.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imageSpec)),
    });
    await page.waitForFunction(() => !document.querySelector("#preview img"));
    assert.equal(await page.locator("#pictures").inputValue(), "");
    await page
      .locator("#pictures")
      .setInputFiles(
        new URL("../examples/gleaner/logo.png", import.meta.url).pathname,
      );
    assert.equal(
      await page.locator("#preview img").getAttribute("alt"),
      "Logo",
    );

    await page.locator("#import").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.startsWith("Import failed"),
    );
    assert.match(await page.locator("#status").innerText(), /Import failed/);
    assert.deepEqual(await downloadSpec(), imageSpec);
    assert.deepEqual(errors, []);
    await page.close({ runBeforeUnload: false });
  } finally {
    await browser.close();
  }
});
