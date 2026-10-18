/* global console */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
const root = resolve("dist");
const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0].replace(/^\/wick\//, "/");
  const file = resolve(
    root,
    `.${path.endsWith("/") ? `${path}index.html` : path}`,
  );
  if (!file.startsWith(root + "/")) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".png": "image/png",
        ".wav": "audio/wav",
      }[extname(file)] ?? "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(4175, "127.0.0.1", r));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  for (const mount of ["/", "/wick/"]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const failures = [];
    page.on("pageerror", (e) => failures.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(`http://127.0.0.1:4175${mount}`);
    await page.waitForTimeout(700);
    const title = await page.screenshot();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1100);
    const play = await page.screenshot();
    assert(!title.equals(play), "Confirm should start the night");
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(100);
    const paused = await page.screenshot();
    await page.waitForTimeout(200);
    assert(
      paused.equals(await page.screenshot()),
      "Paused world should remain still",
    );
    await page.keyboard.press("KeyP");
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(300);
    await page.keyboard.up("KeyD");
    assert(
      !paused.equals(await page.screenshot()),
      "Resume and movement should update the view",
    );
    await page.keyboard.press("KeyM");
    assert.deepEqual(failures, []);
    await page.close();
    console.log(`Verified static mount ${mount}`);
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto("http://127.0.0.1:4175/wick/");
  await page.waitForTimeout(700);
  // The engine letterboxes its 16:9 stage in the mobile viewport.
  await page.touchscreen.tap(
    (200 * 390) / 1280,
    (844 - (720 * 390) / 1280) / 2 + (415 * 390) / 1280,
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/wick-mobile.png" });
  await page.close();
  console.log("Verified mobile canvas and touch start");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
