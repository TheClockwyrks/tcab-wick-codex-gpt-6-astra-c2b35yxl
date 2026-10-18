import type { InitApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
export const images: Record<string, ImageBitmap> = {};
export const FRONTISPIECE = "sprites/frontispiece.png";
export function imagePaths(): string[] {
  return [
    FRONTISPIECE,
    C.GROUND_TILE_PATH,
    C.LAMPLIGHTER_IDLE_PATH,
    ...Array.from(
      { length: C.LAMPLIGHTER_WALK_SHEET.frames },
      (_, i) => `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
    ),
    ...C.ENEMY_IDS.flatMap((id) =>
      Array.from(
        { length: C.ENEMY_FRAMES },
        (_, i) => `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
      ),
    ),
    ...Array.from(
      { length: C.PUFF_SHEET.frames },
      (_, i) => `${C.PUFF_SHEET.dir}/${i}.png`,
    ),
    ...Object.values(C.GEM_PATHS),
    ...Object.values(C.PICKUP_PATHS),
    ...Object.values(C.ICON_PATHS),
    ...Object.values(C.EFFECT_SPRITES).flatMap((e) =>
      e.frames === 1
        ? [e.path]
        : Array.from({ length: e.frames }, (_, i) => `${e.path}/${i}.png`),
    ),
  ];
}
export async function loadAssets(api: InitApi<WickState>) {
  await Promise.all([
    ...imagePaths().map(async (path) => {
      images[path] = await api.assets.loadImage(path);
    }),
    ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
      api.audio.load(cue, path),
    ),
  ]);
}
