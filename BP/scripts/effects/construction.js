/**
 * 建築カテゴリのTNT。壊すのではなく、掘る・均す・建てるためのもの。
 *
 * 形を作る処理そのものは lib/terrain.js にある。ここでは
 * 「どんな形を、どのブロックで、どれくらいの規模で作るか」だけを決める。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { heightLimits } from "../lib/blocks.js";
import {
  buildBridges, buildShelter, buildWall, carveBox, carveTunnels,
  flattenArea, raiseScaffold, spiralStairs,
} from "../lib/terrain.js";
import { later, ring, scatter, shake, sound } from "../lib/fx.js";
import { applyEffects } from "../lib/entities.js";

/** 建材の候補。IDの揺れに備えて複数並べてある */
const STONE = ["minecraft:stone_bricks", "minecraft:stonebrick"];
const PLANKS = ["minecraft:oak_planks", "minecraft:planks"];
const PATH = ["minecraft:stone_bricks", "minecraft:stonebrick"];

export function tunnelEffect(dimension, center) {
  announce("§7⛏ トンネルTNT: 四方に道が通った ⛏§r");
  carveTunnels(dimension, center, { width: 1, length: 28, priority: 4 });
  sound(dimension, "random.explode", center, { pitch: 0.7 });
  scatter(dimension, "minecraft:basic_smoke_particle", center, { count: 20, radius: 6, height: 3 });
}

export function flattenEffect(dimension, center) {
  announce("§6▬ 整地TNT: 地面が平らになった ▬§r");
  flattenArea(dimension, center, { radius: 12, height: 24, fill: "minecraft:dirt", priority: 4 });
  shake(dimension, center, { radius: 25, intensity: 0.4, seconds: 1.5 });
  sound(dimension, "random.explode", center, { pitch: 0.6 });
}

export function wallEffect(dimension, center) {
  announce("§7▣ 防壁TNT: 壁がせり上がった ▣§r");
  buildWall(dimension, center, { radius: 10, height: 6, thickness: 1, candidates: STONE, priority: 3 });
  sound(dimension, "random.anvil_land", center, { pitch: 0.6 });
  ring(dimension, "minecraft:basic_crit_particle", center, 10, { count: 32, y: 1 });
}

export function towerEffect(dimension, center) {
  announce("§e▲ 塔TNT: 塔が建った ▲§r");
  // 芯と、それを巻く螺旋階段
  raiseScaffold(dimension, center, { height: 28, candidates: STONE, priority: 3 });
  spiralStairs(dimension, center, { radius: 3, height: 28, direction: 1, candidates: STONE, priority: 3 });
  sound(dimension, "random.anvil_use", center);
  later(20, () => sound(dimension, "random.levelup", center));
}

export function bridgeEffect(dimension, center) {
  announce("§6═ 架橋TNT: 四方に橋が架かった ═§r");
  buildBridges(dimension, center, { length: 22, width: 1, candidates: PLANKS, priority: 3 });
  sound(dimension, "dig.wood", center);
}

export function shelterEffect(dimension, center) {
  announce("§6⌂ 避難所TNT: 小屋ができた ⌂§r");
  buildShelter(dimension, center, { radius: 4, height: 4, candidates: PLANKS, priority: 3 });
  applyEffects(dimension, center, 8, [["minecraft:regeneration", 100, 0, true]]);
  sound(dimension, "dig.wood", center);
}

export function quarryEffect(dimension, center) {
  announce("§8▩ 採掘場TNT: 掘り抜いた ▩§r");
  carveBox(dimension, center, { radius: 8, top: 1, bottom: -14, priority: 5 });
  shake(dimension, center, { radius: 30, intensity: 0.5, seconds: 2 });
  sound(dimension, "random.explode", center, { pitch: 0.55 });
}

export function stairwayEffect(dimension, center) {
  announce("§7≡ 階段TNT: 地下へ降りられる ≡§r");
  if (mayBreakBlocks()) {
    const limits = heightLimits(dimension);
    const depth = Math.min(48, Math.max(4, Math.floor(center.y) - limits.min - 6));
    spiralStairs(dimension, center, { radius: 3, height: depth, direction: -1, priority: 4 });
  }
  sound(dimension, "random.explode", center, { pitch: 0.8 });
}

export function paveEffect(dimension, center) {
  announce("§f▤ 舗装TNT: 道が通った ▤§r");
  flattenArea(dimension, center, { radius: 9, height: 6, fill: "minecraft:stone_bricks", priority: 3 });
  // 均した上に明かりを並べる
  later(20, () => {
    for (const dir of [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }]) {
      for (let step = 3; step <= 9; step += 3) {
        const loc = {
          x: Math.floor(center.x) + dir.dx * step,
          y: Math.floor(center.y),
          z: Math.floor(center.z) + dir.dz * step,
        };
        placeTorch(dimension, loc);
      }
    }
  });
  sound(dimension, "dig.stone", center);
}

/** 松明を1本立てる。舗装と松明TNTで共用 */
export function placeTorch(dimension, loc) {
  try {
    const block = dimension.getBlock(loc);
    if (!block || block.typeId !== "minecraft:air") return false;
    const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
    if (!below || below.typeId === "minecraft:air") return false;
    block.setType("minecraft:torch");
    return true;
  } catch (err) {
    return false;
  }
}

export function scaffoldEffect(dimension, center) {
  announce("§e╫ 足場TNT: 上へ伸びた ╫§r");
  raiseScaffold(dimension, center, { height: 32, candidates: ["minecraft:scaffolding", "minecraft:oak_planks"], priority: 3 });
  sound(dimension, "dig.wood", center, { pitch: 1.3 });
}
