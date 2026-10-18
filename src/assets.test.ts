/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadImage } from "@napi-rs/canvas";
import * as C from "./constants";
import { imagePaths } from "./assets";
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
describe("committed production assets", () => {
  it("ships every sprite at its contractual canvas size", async () => {
    const cases: [string, number, number][] = [
      [
        C.LAMPLIGHTER_IDLE_PATH,
        C.LAMPLIGHTER_SPRITE_WIDTH,
        C.LAMPLIGHTER_SPRITE_HEIGHT,
      ],
      [C.GROUND_TILE_PATH, C.GROUND_TILE_SIZE, C.GROUND_TILE_SIZE],
    ];
    for (let i = 0; i < C.LAMPLIGHTER_WALK_SHEET.frames; i++)
      cases.push([
        `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
        C.LAMPLIGHTER_SPRITE_WIDTH,
        C.LAMPLIGHTER_SPRITE_HEIGHT,
      ]);
    for (const id of C.ENEMY_IDS)
      for (let i = 0; i < C.ENEMY_FRAMES; i++)
        cases.push([
          `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
          C.ENEMIES[id].radius * 2,
          C.ENEMIES[id].radius * 2,
        ]);
    for (const tier of C.GEM_TIERS)
      cases.push([
        C.GEM_PATHS[tier],
        C.GEM_SPRITE_SIZES[tier],
        C.GEM_SPRITE_SIZES[tier],
      ]);
    for (const kind of C.PICKUP_KINDS)
      cases.push([
        C.PICKUP_PATHS[kind],
        C.PICKUP_SPRITE_SIZE,
        C.PICKUP_SPRITE_SIZE,
      ]);
    for (const path of Object.values(C.ICON_PATHS))
      cases.push([path, C.ICON_SIZE, C.ICON_SIZE]);
    for (const effect of Object.values(C.EFFECT_SPRITES))
      for (let i = 0; i < effect.frames; i++)
        cases.push([
          effect.frames === 1 ? effect.path : `${effect.path}/${i}.png`,
          effect.width,
          effect.height,
        ]);
    for (const [path, w, h] of cases) {
      const img = await loadImage(await readFile(`assets/${path}`));
      expect([img.width, img.height], path).toEqual([w, h]);
      expect(imagePaths()).toContain(path);
    }
  });
  it("has distinct frames in every animation and distinct item icons", async () => {
    const dirs = [
      C.LAMPLIGHTER_WALK_SHEET.dir,
      C.PUFF_SHEET.dir,
      ...C.ENEMY_IDS.map((id) => `${C.ENEMY_SHEET_DIR}/${id}`),
      ...Object.values(C.EFFECT_SPRITES)
        .filter((e) => e.frames > 1)
        .map((e) => e.path),
      "icons",
    ];
    for (const dir of dirs) {
      const files = (await readdir(`assets/${dir}`)).filter((f) =>
        f.endsWith(".png"),
      );
      const hashes = await Promise.all(
        files.map(async (file) =>
          hash(await readFile(`assets/${dir}/${file}`)),
        ),
      );
      expect(new Set(hashes).size, dir).toBe(files.length);
    }
  });
  it("ships distinct audible cues, long loops, a MIDI score, and seamless endpoints", async () => {
    const hashes = [];
    for (const [cue, path] of Object.entries(C.CUE_PATHS)) {
      const data = await readFile(`assets/${path}`);
      hashes.push(hash(data));
      expect(data.toString("ascii", 0, 4)).toBe("RIFF");
      expect(data.toString("ascii", 8, 12)).toBe("WAVE");
      let offset = 12,
        pcm = 0,
        length = 0,
        sampleRate = 0,
        channels = 0;
      while (offset + 8 <= data.length) {
        const size = data.readUInt32LE(offset + 4),
          tag = data.toString("ascii", offset, offset + 4);
        if (tag === "fmt ") {
          channels = data.readUInt16LE(offset + 10);
          sampleRate = data.readUInt32LE(offset + 12);
          expect(data.readUInt16LE(offset + 22)).toBe(16);
        }
        if (tag === "data") {
          pcm = offset + 8;
          length = size;
          break;
        }
        offset += 8 + size + (size % 2);
      }
      expect(length).toBeGreaterThan(0);
      let energy = 0;
      for (let i = pcm; i < pcm + length; i += 2)
        energy += (data.readInt16LE(i) / 32768) ** 2;
      expect(Math.sqrt(energy / (length / 2)), cue).toBeGreaterThan(0.0005);
      if (cue === C.CUES.music || cue === C.CUES.hum) {
        expect(length / 2 / channels / sampleRate).toBeGreaterThanOrEqual(
          cue === C.CUES.music ? C.MUSIC_MIN_SECONDS : C.HUM_MIN_SECONDS,
        );
        for (let ch = 0; ch < channels; ch++)
          expect(
            Math.abs(
              data.readInt16LE(pcm + ch * 2) -
                data.readInt16LE(pcm + length - channels * 2 + ch * 2),
            ) / 32768,
          ).toBeLessThanOrEqual(C.LOOP_SEAM_TOLERANCE);
      }
    }
    expect(new Set(hashes).size).toBe(Object.keys(C.CUE_PATHS).length);
    const midi = await readFile(`assets/${C.MUSIC_SCORE_PATH}`);
    expect(midi.toString("ascii", 0, 4)).toBe("MThd");
  });
});
