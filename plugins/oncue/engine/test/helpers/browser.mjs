// @ts-check
/** Browser prerequisites must use the same selection as the CLI they guard. */
import capture from "../../dist/capture.js";

/** @returns {Promise<import("playwright").Browser>} */
export async function launchBrowser() {
  const { chromium } = await import("playwright");
  return chromium.launch(capture.launchOptions());
}
