import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
import type { WickRect } from "./debug-types";
import { type Draft, enter, start, title, choose } from "./model";
export const entries = (tab: number): readonly string[] =>
  [
    [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
    C.PASSIVE_IDS,
    C.ENEMY_IDS,
    [...C.GEM_TIERS, ...C.PICKUP_KINDS],
  ][tab] ?? [];
export function menuRects(s: WickState): WickRect[] {
  if (s.screen === "playing") return [];
  if (s.screen === "almanac")
    return Array.from(
      {
        length: Math.min(
          C.ALMANAC_ROWS,
          entries(s.almanacTab).length - s.almanacScroll,
        ),
      },
      (_, i) => ({ x: 70, y: 190 + i * 42, width: 310, height: 38 }),
    );
  if (s.screen === "howto" || s.screen === "chest")
    return [{ x: 470, y: 608, width: 340, height: 48 }];
  const count =
    s.screen === "title"
      ? C.TITLE_ITEMS.length
      : s.screen === "levelup"
        ? s.run.offers.length
        : 2;
  return Array.from({ length: count }, (_, i) => ({
    x: s.screen === "title" ? 132 : 390,
    y:
      (s.screen === "title" ? 390 : s.screen === "levelup" ? 290 : 430) +
      i * (s.screen === "levelup" ? 82 : 62),
    width: s.screen === "title" ? 360 : 500,
    height: s.screen === "levelup" ? 70 : 50,
  }));
}
export const tabRects = (s: WickState): WickRect[] =>
  s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 70 + i * 285,
        y: 120,
        width: 270,
        height: 44,
      }))
    : [];
export function followHighlight(s: Draft) {
  const count = entries(s.almanacTab).length;
  s.almanacScroll = Math.max(
    0,
    Math.min(
      Math.max(0, count - C.ALMANAC_ROWS),
      Math.max(
        Math.min(s.almanacScroll, s.menuIndex),
        s.menuIndex - C.ALMANAC_ROWS + 1,
      ),
    ),
  );
}
function accept(s: Draft, cues: Set<C.CueName>) {
  switch (s.screen) {
    case "title":
      cues.add(C.CUES.menuConfirm);
      if (s.menuIndex === 0) start(s);
      else enter(s, s.menuIndex === 1 ? "almanac" : "howto");
      break;
    case "paused":
      cues.add(C.CUES.menuConfirm);
      if (s.menuIndex === 0) enter(s, "playing");
      else title(s);
      break;
    case "fallen":
    case "dawn":
      cues.add(C.CUES.menuConfirm);
      if (s.menuIndex === 0) start(s);
      else title(s);
      break;
    case "levelup":
      choose(s, s.menuIndex);
      cues.add(C.CUES.choose);
      if (s.screen === "levelup") cues.add(C.CUES.levelUp);
      break;
    case "chest":
      s.run.chestResult = null;
      enter(s, "playing");
      break;
  }
}
function back(s: Draft) {
  if (s.screen === "playing") enter(s, "paused");
  else if (s.screen === "paused") enter(s, "playing");
  else if (s.screen === "howto") title(s, 2);
  else if (s.screen === "almanac") title(s, 1);
  else if (s.screen === "fallen" || s.screen === "dawn") title(s);
}
const contains = (r: WickRect, x: number, y: number) =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
export function input(s: Draft, api: UpdateApi): { dx: number; dy: number } {
  const screen = s.screen;
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const dx = api.input.value("right") - api.input.value("left"),
    dy = api.input.value("down") - api.input.value("up");
  const cues = new Set<C.CueName>();
  if (edges.mute) api.audio.setMuted(!api.audio.muted());
  const move = (index: number) => {
    if (index !== s.menuIndex) {
      s.menuIndex = index;
      cues.add(C.CUES.menuMove);
      if (s.screen === "almanac") followHighlight(s);
    }
  };
  const changeTab = (index: number) => {
    if (index !== s.almanacTab) {
      s.almanacTab = index;
      s.menuIndex = 0;
      s.almanacScroll = 0;
      cues.add(C.CUES.menuMove);
    }
  };
  if (screen === "almanac" && (edges.left || edges.right))
    changeTab(
      (s.almanacTab + (edges.right ? 1 : -1) + C.ALMANAC_TABS.length) %
        C.ALMANAC_TABS.length,
    );
  if (
    ["title", "almanac", "levelup", "paused", "fallen", "dawn"].includes(
      screen,
    ) &&
    (edges.up || edges.down)
  ) {
    const count =
      screen === "almanac" ? entries(s.almanacTab).length : menuRects(s).length;
    if (count) move((s.menuIndex + (edges.down ? 1 : -1) + count) % count);
  }
  if (edges.back) back(s);
  else if (edges.pause && (screen === "playing" || screen === "paused"))
    enter(s, screen === "playing" ? "paused" : "playing");
  else if (edges.confirm) accept(s, cues);
  const samples = api.input.pointerSamples();
  const wheel = api.input.wheel();
  // Edges belong to the screen the frame began on. Never click through a transition.
  if (s.screen === screen) {
    const locate = (x: number, y: number) => {
      const tab = tabRects(s).findIndex((r) => contains(r, x, y));
      if (tab >= 0) return `tab:${tab}`;
      const index = menuRects(s).findIndex((r) => contains(r, x, y));
      return index >= 0
        ? `menu:${index + (screen === "almanac" ? s.almanacScroll : 0)}`
        : "";
    };
    for (const sample of samples) {
      if (!sample.primary) continue;
      const target = locate(sample.x, sample.y);
      const index = Number(target.split(":")[1]);
      if (
        sample.type === "move" &&
        sample.device !== "touch" &&
        !sample.buttons.includes("primary") &&
        target.startsWith("menu:") &&
        !["howto", "chest"].includes(screen)
      )
        move(index);
      if (sample.type === "down" && sample.button === "primary") {
        if (target.startsWith("menu:") && !["howto", "chest"].includes(screen))
          move(index);
        s.visual.pointerDown = target
          ? { id: sample.id, target, screen }
          : null;
      }
      if (sample.type === "up" && sample.button === "primary") {
        const armed = s.visual.pointerDown;
        s.visual.pointerDown = null;
        if (
          armed &&
          armed.id === sample.id &&
          armed.screen === screen &&
          armed.target === target
        ) {
          if (target.startsWith("tab:")) changeTab(index);
          else if (screen === "howto") back(s);
          else if (screen !== "almanac") {
            s.menuIndex = index;
            accept(s, cues);
          }
          if (s.screen !== screen) break;
        }
      }
    }
    if (s.screen === "almanac") {
      const max = Math.max(0, entries(s.almanacTab).length - C.ALMANAC_ROWS);
      s.almanacScroll = Math.max(
        0,
        Math.min(max, s.almanacScroll + Math.trunc(wheel.y / C.WHEEL_ROW)),
      );
    }
  }
  for (const cue of cues) api.audio.play(cue);
  return { dx, dy };
}
