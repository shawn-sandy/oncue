// @ts-check
/** Run the real validator against disposable marketplaces, never modifying the source package. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** @param {{ compatibility?: string, body?: string, refs?: Record<string, string>, name?: string }} options */
function validate({ compatibility = "compatibility: 'Node.js 22+.'", body = "Use supplied material.", refs = {}, name = "storyboard" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "oncue-validator-"));
  /** @param {string} path @param {string} text */
  const write = (path, text) => { const file = join(dir, path); mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, text); };
  try {
    mkdirSync(join(dir, "scripts"));
    copyFileSync(new URL("../validate.mjs", import.meta.url), join(dir, "scripts", "validate.mjs"));
    write(".claude-plugin/marketplace.json", JSON.stringify({ name: "test", description: "Fixture", owner: { name: "Test" }, plugins: [{ name: "oncue", source: "./plugins/oncue" }] }));
    write("plugins/oncue/.claude-plugin/plugin.json", JSON.stringify({ name: "oncue", version: "1.0.0", description: "Fixture", author: { name: "Test" } }));
    write(`plugins/oncue/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: Test this workflow.\n${compatibility}\n---\n\n${body}\n`);
    for (const [path, text] of Object.entries(refs)) write(`plugins/oncue/skills/${name}/references/${path}`, text);
    write("README.md", "Fixture\n");
    // Isolate the optional external CLI: these fixtures test this script, not Claude installation.
    return spawnSync(process.execPath, [join(dir, "scripts", "validate.mjs")], { encoding: "utf8", env: { ...process.env, PATH: "" } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("accepts valid requirements, including the 500-character limit", () => {
  for (const text of ["'Node.js 22+.'", `'${"x".repeat(500)}'`, "'Node''s engine'"]) {
    const run = validate({ compatibility: `compatibility: ${text}` });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  }
});

for (const [label, compatibility] of [
  ["missing", ""], ["empty", "compatibility:"], ["quoted empty", 'compatibility: ""'],
  ["whitespace", 'compatibility: "   "'], ["oversized", `compatibility: '${"x".repeat(501)}'`],
  ["literal multiline", "compatibility: |\n  Node.js 22+."], ["folded multiline", "compatibility: >-\n  Node.js 22+."],
  ["continued multiline", "compatibility: Node.js\n  22+."],
  ["comment only", "compatibility: # requirements pending"],
  ["YAML collection", "compatibility: [Node.js]"],
  ["YAML boolean", "compatibility: false"],
  ["YAML null", "compatibility: null"],
  ["duplicate field", "compatibility: 'Node.js'\ncompatibility: 'Browser'"],
  ["unquoted", "compatibility: Node.js 22+."],
  ["YAML mapping", "compatibility: Requirements: Node.js 22+"],
  ["unescaped apostrophe", "compatibility: 'Node's engine'"],
  ["invalid YAML escape", 'compatibility: "Browser at C:\\Users\\me\\chrome.exe"'],
]) {
  test(`rejects ${label} compatibility`, () => {
    const run = validate({ compatibility });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /compatibility/);
  });
}

for (const body of ["Use claude.ai Settings → Capabilities.", "Run `claude plugin list`.", "Choose `/mcp`.", "Copy to the person's folder when their computer is linked.", "Run `codex plugin add oncue@oncue`.", "In ChatGPT, open Admin → Plugins."]) {
  test(`rejects shared host assumption: ${body}`, () => {
    const run = validate({ body });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /host-specific/);
  });
}

test("checks nested Markdown references for host assumptions and broken links", () => {
  for (const text of ["Use claude.ai settings.", "See [missing](./absent.md). "]) {
    const run = validate({ refs: { "nested/guide.md": text } });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /nested\/guide.md/);
  }
});

test("allows setup host branches", () => {
  const run = validate({ name: "setup", body: "## Claude Code\nRun `claude plugin list`.\n\n## ChatGPT\nAsk the workspace administrator." });
  assert.equal(run.status, 0, run.stderr);
});

test("preserves a guarded Claude Design System adapter, without exempting its other sections", () => {
  const adapter = "## Design System artifacts\n\nOnly in Claude sessions with an Artifact tool that supports the Design System type. Otherwise skip this adapter.\nRead the claude.ai Design System with that tool.\n";
  const valid = validate({ refs: { "theme.md": adapter } });
  assert.equal(valid.status, 0, valid.stderr);
  for (const text of [adapter.replace("Only in Claude sessions with an Artifact tool that supports the Design System type. Otherwise skip this adapter.", "Use this everywhere."), `${adapter}\n## Another route\nUse claude.ai settings.`]) {
    const invalid = validate({ refs: { "theme.md": text } });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /host-specific/);
  }
});
