/* Developer-only capture. Start `npm run dev` first; no page globals are exposed. */
/* global console, document, KeyboardEvent */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => {
  throw error;
});
await mkdir("showcase", { recursive: true });
await page.goto("http://localhost:5173");
await page.waitForTimeout(800);
await page.screenshot({ path: "showcase/title.png" });
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
await page.screenshot({ path: "showcase/almanac.png" });
await page.route("**/capture.html", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><body style="margin:0;background:#0b1b23"><canvas id="capture" style="width:1280px;height:720px;display:block"></canvas></body></html>',
  }),
);
await page.goto("http://localhost:5173/capture.html");
const recording = await page.evaluate(async () => {
  const { createEngine, ConstantClock } =
    await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const engine = createEngine({
    canvas: document.getElementById("capture"),
    width: 1280,
    height: 720,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 60),
  });
  await engine.initialize();
  const d = engine.debug;
  const apply = (fn) => engine.apply(fn);
  apply((s) => d.setScreen(s, "playing"));
  apply((s) => d.setTick(s, 26700));
  apply((s) => d.setLevel(s, 24));
  apply((s) => d.setKills(s, 1286));
  for (const [i, id, level] of [
    [0, "pyre", 1],
    [1, "beacon", 1],
    [2, "lantern", 8],
    [3, "halo", 8],
    [4, "spark", 6],
    [5, "shard", 6],
  ])
    apply((s) => d.setWeapon(s, i, id, level));
  for (const [i, id, level] of [
    [0, "wick", 4],
    [1, "oil", 3],
    [2, "glass", 3],
    [3, "brass", 3],
    [4, "tallow", 3],
    [5, "lure", 2],
  ])
    apply((s) => d.setPassive(s, i, id, level));
  apply((s) => d.setHp(s, 126));
  const types = [
    "moth",
    "bat",
    "rat",
    "beetle",
    "wisp",
    "spider",
    "crow",
    "shade",
    "hound",
  ];
  for (let i = 0; i < 100; i++) {
    const angle = i * 2.39996,
      rad = 170 + (i % 9) * 48;
    apply((s) =>
      d.spawnEnemy(
        s,
        types[i % types.length],
        Math.cos(angle) * rad,
        Math.sin(angle) * rad * 0.7,
      ),
    );
  }
  apply((s) => d.spawnEnemy(s, "mothwing", -330, 125));
  apply((s) => d.spawnEnemy(s, "owl", 360, -80));
  for (let i = 0; i < 38; i++) {
    const a = i * 2.39,
      rad = 65 + i * 7;
    apply((s) =>
      d.spawnGem(
        s,
        i % 8 === 0 ? "large" : i % 3 === 0 ? "medium" : "small",
        Math.cos(a) * rad,
        Math.sin(a) * rad * 0.7,
      ),
    );
  }
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
  await engine.advance(4);
  engine.startRecording();
  await engine.advance(150);
  document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
  const result = engine.stopRecording();
  // Leave a dramatic, live combat frame as the screenshot.
  apply((s) => d.setWeaponCooldown(s, 0, 0));
  apply((s) => d.setWeaponCooldown(s, 4, 0));
  await engine.advance(1);
  return JSON.stringify(result);
});
await page.screenshot({ path: "showcase/night.png" });
await writeFile("showcase/night.json.gz", gzipSync(recording));
console.log("Captured 150 engine frames and three screenshots.");
await browser.close();
