// @ts-check
/** Browser selection must be explicit, without changing Playwright's default launch. */
import { test } from "node:test";
import assert from "node:assert/strict";
import capture from "../dist/capture.js";

/** @type {Array<[string, NodeJS.ProcessEnv, { executablePath?: string }]>} */
const cases = [
  ["unset override", {}, {}],
  ["empty override", { ONCUE_CHROMIUM_PATH: "" }, {}],
  ["explicit executable", { ONCUE_CHROMIUM_PATH: "/opt/chromium/chrome" }, { executablePath: "/opt/chromium/chrome" }],
  ["path with spaces", { ONCUE_CHROMIUM_PATH: "/Applications/Browser App/chrome" }, { executablePath: "/Applications/Browser App/chrome" }],
];
for (const [label, env, expected] of cases) {
  test(`browser launch options: ${label}`, () => {
    assert.deepEqual(capture.launchOptions(env), expected);
  });
}

test("browser launch options read the session environment by default", () => {
  const before = process.env.ONCUE_CHROMIUM_PATH;
  try {
    process.env.ONCUE_CHROMIUM_PATH = "/opt/session/chrome";
    assert.deepEqual(capture.launchOptions(), { executablePath: "/opt/session/chrome" });
  } finally {
    if (before === undefined) delete process.env.ONCUE_CHROMIUM_PATH;
    else process.env.ONCUE_CHROMIUM_PATH = before;
  }
});
