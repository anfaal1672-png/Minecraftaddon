import { BlockStates, system } from "@minecraft/server";
import { getBlock, isAir, isLiquidType, placeBlock, spawnItemSafe } from "../core/safety.js";
import { nearbyEntities, addEffect, spawnEntitySafe } from "../core/entities.js";
import { announce, msg } from "../systems/i18n.js";
import { attempt } from "../util/log.js";
import { cardinal, floorLoc, pick, randInt, weightedPick } from "../util/math.js";
import { burst, discLocs, forEachBlock, sound, sphereLocs, below } from "./common.js";

/* ------------------------------------------------------------------ */
/*  地形・資源系TNTの効果                                              */
/* ------------------------------------------------------------------ */
const toss = () => ({ x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3 });
const near = (center, spread, dy = 0.5) => ({
  x: center.x + (Math.random() - 0.5) * spread,
  y: center.y + dy,
  z: center.z + (Math.random() - 0.5) * spread,
});

/**
 * お宝TNT (B25)。
 * 以前は TNT + 金インゴット1個から平均ダイヤ約4個が出る「無限ダイヤ製造機」だった。
 * 今は欠片や鉄が中心で、宝石はまれ。期待値は材料 (金インゴット + TNT) を下回る。
 */
export const TREASURE_TABLE = [
  { value: ["minecraft:iron_nugget", 1, 4], weight: 35 },
  { value: ["minecraft:gold_nugget", 1, 4], weight: 30 },
  { value: ["minecraft:copper_ingot", 1, 2], weight: 15 },
  { value: ["minecraft:iron_ingot", 1, 1], weight: 12 },
  { value: ["minecraft:lapis_lazuli", 1, 3], weight: 6 },
  { value: ["minecraft:emerald", 1, 1], weight: 1.5 },
  { value: ["minecraft:diamond", 1, 1], weight: 0.5 },
];
export const TREASURE_ROLLS = 4;
export function treasureEffect(dimension, center) {
  for (let i = 0; i < TREASURE_ROLLS; i++) {
    const [id, lo, hi] = weightedPick(TREASURE_TABLE);
    spawnItemSafe(dimension, id, randInt(lo, hi), near(center, 2), toss());
  }
  sound(dimension, "random.levelup", center);
}

/**
 * 運試しTNT (B26)。大当たり 30% / はずれ 70%。
 * ネザライトの欠片は大当たりの中でもさらに 5% のごく低確率にした。
 */
export const FORTUNE_JACKPOT = [
  { value: ["minecraft:emerald", 1, 2], weight: 70 },
  { value: ["minecraft:diamond", 1, 1], weight: 25 },
  { value: ["minecraft:netherite_scrap", 1, 1], weight: 5 },
];
export const FORTUNE_WIN_CHANCE = 0.3;
export function fortuneEffect(dimension, center) {
  if (Math.random() < FORTUNE_WIN_CHANCE) {
    announce(msg("fortune_win"));
    for (let i = 0; i < 3; i++) {
      const [id, lo, hi] = weightedPick(FORTUNE_JACKPOT);
      spawnItemSafe(dimension, id, randInt(lo, hi), near(center, 2, 1), toss());
    }
    sound(dimension, "random.levelup", center);
  } else {
    announce(msg("fortune_lose"));
    for (const ent of nearbyEntities(dimension, center, 5)) {
      addEffect(ent, "minecraft:weakness", 200, 1);
      addEffect(ent, "minecraft:unluck", 200, 0);
    }
  }
}

/** 鉱石のある岩の種類 (鉱石を取り除いた後はこれで埋めて、地形に穴を開けない) */
function hostRock(typeId) {
  if (typeId.includes("deepslate")) return "minecraft:deepslate";
  if (typeId === "minecraft:nether_gold_ore" || typeId === "minecraft:quartz_ore" || typeId === "minecraft:ancient_debris") {
    return "minecraft:netherrack";
  }
  return "minecraft:stone";
}

const ORE_SMELT = {
  "minecraft:iron_ore": "minecraft:iron_ingot",
  "minecraft:deepslate_iron_ore": "minecraft:iron_ingot",
  "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:deepslate_gold_ore": "minecraft:gold_ingot",
  "minecraft:copper_ore": "minecraft:copper_ingot",
  "minecraft:deepslate_copper_ore": "minecraft:copper_ingot",
  "minecraft:ancient_debris": "minecraft:netherite_scrap",
};
export function smelterEffect(dimension, center) {
  forEachBlock("smelter", dimension, sphereLocs(center, 6), (b, loc) => {
    const drop = ORE_SMELT[b.typeId];
    if (!drop) return;
    b.setType(hostRock(b.typeId));
    spawnItemSafe(dimension, drop, 1, { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
  });
  burst(dimension, "minecraft:basic_flame_particle", center, 12, 6);
}

/** 採掘TNT: 鉱石だけを掘ってドロップさせ、跡は元の岩で埋める */
const ORE_DROPS = {
  "minecraft:coal_ore": ["minecraft:coal", 1, 1],
  "minecraft:deepslate_coal_ore": ["minecraft:coal", 1, 1],
  "minecraft:iron_ore": ["minecraft:raw_iron", 1, 1],
  "minecraft:deepslate_iron_ore": ["minecraft:raw_iron", 1, 1],
  "minecraft:copper_ore": ["minecraft:raw_copper", 2, 5],
  "minecraft:deepslate_copper_ore": ["minecraft:raw_copper", 2, 5],
  "minecraft:gold_ore": ["minecraft:raw_gold", 1, 1],
  "minecraft:deepslate_gold_ore": ["minecraft:raw_gold", 1, 1],
  "minecraft:redstone_ore": ["minecraft:redstone", 4, 5],
  "minecraft:lit_redstone_ore": ["minecraft:redstone", 4, 5],
  "minecraft:deepslate_redstone_ore": ["minecraft:redstone", 4, 5],
  "minecraft:lit_deepslate_redstone_ore": ["minecraft:redstone", 4, 5],
  "minecraft:lapis_ore": ["minecraft:lapis_lazuli", 4, 9],
  "minecraft:deepslate_lapis_ore": ["minecraft:lapis_lazuli", 4, 9],
  "minecraft:diamond_ore": ["minecraft:diamond", 1, 1],
  "minecraft:deepslate_diamond_ore": ["minecraft:diamond", 1, 1],
  "minecraft:emerald_ore": ["minecraft:emerald", 1, 1],
  "minecraft:deepslate_emerald_ore": ["minecraft:emerald", 1, 1],
  "minecraft:nether_gold_ore": ["minecraft:gold_nugget", 2, 6],
  "minecraft:quartz_ore": ["minecraft:quartz", 1, 1],
  "minecraft:ancient_debris": ["minecraft:ancient_debris", 1, 1],
};
export function miningEffect(dimension, center) {
  forEachBlock("mining", dimension, sphereLocs(center, 6), (b, loc) => {
    const drop = ORE_DROPS[b.typeId];
    if (!drop) return;
    b.setType(hostRock(b.typeId));
    spawnItemSafe(dimension, drop[0], randInt(drop[1], drop[2]), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
  });
  burst(dimension, "minecraft:crit_particle", center, 12, 8);
}

/* ---------- 作物 (B08: 状態名と最大値をブロックごとに自動判定) ---------- */
const CROP_STATES = {
  "minecraft:wheat": "growth",
  "minecraft:carrots": "growth",
  "minecraft:potatoes": "growth",
  "minecraft:beetroot": "growth",
  "minecraft:nether_wart": "age",
};
const maxCache = new Map();

/** そのブロックで有効な、状態 state の最大値を調べる */
export function maxStateValue(block, state) {
  const cached = maxCache.get(block.typeId);
  if (cached !== undefined) return cached;
  const values = attempt("validValues", () => BlockStates.get(state)?.validValues) ?? [0, 1, 2, 3, 4, 5, 6, 7];
  const nums = values.filter((v) => typeof v === "number").sort((a, b) => b - a);
  for (const v of nums) {
    try {
      block.permutation.withState(state, v);
    } catch (err) {
      continue; // このブロックでは無効な値 (大きい値から順に試しているので想定内)
    }
    maxCache.set(block.typeId, v);
    return v;
  }
  return undefined;
}

function cropInfo(block) {
  const state = CROP_STATES[block.typeId];
  if (!state) return undefined;
  const current = attempt("getState", () => block.permutation.getState(state));
  const max = maxStateValue(block, state);
  if (typeof current !== "number" || max === undefined) return undefined;
  return { state, current, max };
}

export function harvestEffect(dimension, center) {
  forEachBlock("harvest", dimension, discLocs(center, 6, -1, 1), (b) => {
    const c = cropInfo(b);
    if (c && c.current < c.max) b.setPermutation(b.permutation.withState(c.state, c.max));
  });
  burst(dimension, "minecraft:villager_happy", center, 12, 8);
}

const REAP_DROPS = {
  "minecraft:wheat": [["minecraft:wheat", 1, 1], ["minecraft:wheat_seeds", 0, 2]],
  "minecraft:carrots": [["minecraft:carrot", 1, 4]],
  "minecraft:potatoes": [["minecraft:potato", 1, 4]],
  "minecraft:beetroot": [["minecraft:beetroot", 1, 1], ["minecraft:beetroot_seeds", 0, 2]],
  "minecraft:nether_wart": [["minecraft:nether_wart", 1, 3]],
};
/** 収穫祭TNT: 実った作物を収穫し、成長段階0に戻して植え直す */
export function reaperEffect(dimension, center) {
  forEachBlock("reaper", dimension, discLocs(center, 8, -1, 1), (b, loc) => {
    const c = cropInfo(b);
    if (!c || c.current < c.max) return;
    for (const [id, lo, hi] of REAP_DROPS[b.typeId] ?? []) {
      const n = randInt(lo, hi);
      if (n > 0) spawnItemSafe(dimension, id, n, { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
    }
    b.setPermutation(b.permutation.withState(c.state, 0));
  });
  burst(dimension, "minecraft:villager_happy", center, 16, 12);
}

/** 建材TNT (B31: 土道の正しいIDは grass_path) */
const UPGRADE = {
  "minecraft:cobblestone": "minecraft:stone_bricks",
  "minecraft:dirt": "minecraft:grass_path",
  "minecraft:oak_log": "minecraft:oak_planks",
  "minecraft:sand": "minecraft:sandstone",
};
export function builderEffect(dimension, center) {
  forEachBlock("builder", dimension, discLocs(center, 5, -1, -1), (b, loc) => {
    const up = UPGRADE[b.typeId];
    if (!up) return;
    // 土道は上が空いていないと置けない
    if (up === "minecraft:grass_path" && !isAir(getBlock(dimension, { x: loc.x, y: loc.y + 1, z: loc.z }))) return;
    b.setType(up);
  });
}

export function desertEffect(dimension, center) {
  forEachBlock("desert", dimension, discLocs(center, 5, -1, -1), (b, loc) => {
    if (b.typeId === "minecraft:grass_block" || b.typeId === "minecraft:dirt") {
      b.setType("minecraft:sand");
      if (Math.random() < 0.08) placeBlock(dimension, { x: loc.x, y: loc.y + 1, z: loc.z }, "minecraft:cactus");
    }
  });
  for (const ent of nearbyEntities(dimension, center, 6)) addEffect(ent, "minecraft:blindness", 40, 0);
}

const PLANTS = ["minecraft:short_grass", "minecraft:poppy", "minecraft:dandelion", "minecraft:blue_orchid", "minecraft:allium"];
function plantOn(dimension, center, R, chance, soils, pickId) {
  forEachBlock("plant", dimension, discLocs(center, R), (b, loc) => {
    if (Math.random() > chance || !isAir(b)) return;
    const under = getBlock(dimension, below(loc));
    if (under && soils.includes(under.typeId)) b.setType(pickId());
  });
}

export function grassEffect(dimension, center) {
  plantOn(dimension, center, 6, 0.4, ["minecraft:grass_block", "minecraft:dirt"], () => pick(PLANTS));
}

export function cactusEffect(dimension, center) {
  plantOn(dimension, center, 4, 0.35, ["minecraft:sand", "minecraft:red_sand"], () => "minecraft:cactus");
}

const SAPLINGS = ["minecraft:oak_sapling", "minecraft:birch_sapling", "minecraft:spruce_sapling", "minecraft:cherry_sapling"];
/** 植林TNT: 草地に苗木を植える */
export function forestEffect(dimension, center) {
  plantOn(dimension, center, 7, 0.15, ["minecraft:grass_block", "minecraft:dirt", "minecraft:podzol"], () => pick(SAPLINGS));
  burst(dimension, "minecraft:villager_happy", center, 20, 12, 2);
}

export function obsidianEffect(dimension, center) {
  forEachBlock("obsidian", dimension, sphereLocs(center, 5, -2, 2), (b) => {
    if (b.typeId === "minecraft:lava" || b.typeId === "minecraft:flowing_lava") b.setType("minecraft:obsidian");
  });
}

export function glowEffect(dimension, center) {
  const c = floorLoc(center);
  for (let i = 0; i < 8; i++) {
    placeBlock(dimension, { x: c.x + randInt(-5, 5), y: c.y + randInt(-2, 2), z: c.z + randInt(-5, 5) }, "minecraft:glowstone");
  }
}

export function honeyEffect(dimension, center) {
  for (const loc of discLocs(center, 3, 0, 1)) {
    if (Math.random() <= 0.6) placeBlock(dimension, loc, "minecraft:honey_block");
  }
}

export function webEffect(dimension, center) {
  for (const loc of discLocs(center, 2, 0, 2)) {
    if (Math.random() <= 0.5) placeBlock(dimension, loc, "minecraft:web");
  }
  for (const ent of nearbyEntities(dimension, center, 4)) addEffect(ent, "minecraft:slowness", 100, 2);
}

export function xpEffect(dimension, center) {
  for (let i = 0; i < 10; i++) {
    system.runTimeout(() => spawnEntitySafe(dimension, "minecraft:xp_orb", near(center, 2)), i * 2);
  }
}

const FOODS = ["minecraft:bread", "minecraft:cooked_beef", "minecraft:apple", "minecraft:cooked_porkchop"];
export function feastEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) addEffect(ent, "minecraft:saturation", 20, 4);
  for (let i = 0; i < 6; i++) spawnItemSafe(dimension, pick(FOODS), 1, near(center, 3));
}

/** 防壁TNT: 半径5の円形に高さ3の石レンガの壁を建てる (空いている場所だけ) */
export function wallEffect(dimension, center) {
  const c = floorLoc(center);
  const locs = [];
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 4.5 || d >= 5.5) continue;
      for (let dy = 0; dy <= 2; dy++) locs.push({ x: c.x + dx, y: c.y + dy, z: c.z + dz });
    }
  }
  forEachBlock("wall", dimension, locs, (b, loc) => placeBlock(dimension, loc, "minecraft:stone_bricks"));
  sound(dimension, "dig.stone", center);
}

/** 橋TNT: 着火した人が向いている方向へ、幅3・長さ24の橋を架ける */
export function bridgeEffect(dimension, center, ctx) {
  const dir = cardinal(attempt("viewDir", () => ctx?.source?.getViewDirection()));
  const side = { x: -dir.z, z: dir.x };
  const c = floorLoc(center);
  const deckY = c.y - 1;
  const deckOk = (b) => isAir(b) || isLiquidType(b.typeId);
  const locs = [];
  for (let i = 1; i <= 24; i++) {
    for (let w = -2; w <= 2; w++) {
      const x = c.x + dir.x * i + side.x * w;
      const z = c.z + dir.z * i + side.z * w;
      if (Math.abs(w) <= 1) locs.push({ loc: { x, y: deckY, z }, id: "minecraft:oak_planks", ok: deckOk });
      else {
        locs.push({ loc: { x, y: deckY, z }, id: "minecraft:oak_planks", ok: deckOk });
        locs.push({ loc: { x, y: deckY + 1, z }, id: "minecraft:oak_fence", ok: isAir });
      }
    }
  }
  const specByLoc = new Map(locs.map((l) => [l.loc, l]));
  forEachBlock("bridge", dimension, specByLoc.keys(), (b, loc) => {
    const spec = specByLoc.get(loc);
    placeBlock(dimension, loc, spec.id, { canReplace: spec.ok });
  });
  sound(dimension, "dig.wood", center);
}
