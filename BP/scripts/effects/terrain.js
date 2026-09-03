/**
 * 地形と植生を作り替えるTNT。壊すより整えるものが多い。
 */
import { ItemStack } from "@minecraft/server";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, heightLimits, setBlock, trySetBlock } from "../lib/blocks.js";
import { carveShaft, scanDisk, scanSphere } from "../lib/terrain.js";
import { applyEffects, dropItem, knockOutward } from "../lib/entities.js";
import { later, scatter, shake, sound } from "../lib/fx.js";
import { pick } from "../lib/math.js";

export function earthquakeEffect(dimension, center) {
  knockOutward(dimension, center, 7, 0.9, { lift: 0.5 });
  shake(dimension, center, { radius: 30, intensity: 0.7, seconds: 2 });
  sound(dimension, "random.explode", center, { pitch: 0.4 });

  if (!mayBreakBlocks()) return;
  // 地割れ。足元を虫食い状に抜いて、地面が裂けたように見せる
  scanDisk(dimension, { ...center, y: center.y - 1 }, { radius: 4, layers: [0, 0], name: "earthquake" },
    (dim, loc) => {
      if (Math.random() > 0.3) return;
      const block = blockAt(dim, loc);
      if (!block || block.typeId === "minecraft:air" || block.typeId === "minecraft:bedrock") return;
      block.setType("minecraft:air");
    });
}

/* ------------------------------------------------------------------ */
/*  草原・砂漠・サボテン                                                */
/* ------------------------------------------------------------------ */

// 草ブロックはバージョンによってIDが違うことがあるので候補を並べておく
export const MEADOW_PLANTS = [
  ["minecraft:short_grass", "minecraft:tallgrass"],
  ["minecraft:poppy"], ["minecraft:dandelion"],
  ["minecraft:blue_orchid"], ["minecraft:allium"], ["minecraft:cornflower"],
];

/** 草ブロックに変えてよい地面 */
export const MEADOW_SOIL = new Set([
  "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol",
  "minecraft:sand", "minecraft:gravel", "minecraft:stone",
]);

export function grassEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  scanDisk(dimension, center, { radius: 6, layers: [0, 0], name: "grass" }, (dim, loc) => {
    const here = blockAt(dim, loc);
    if (!here || here.typeId !== "minecraft:air") return;

    // 元から草ブロックの場所にしか咲かないと草原TNTらしくないので、
    // 土や砂も先に草ブロックへ変えてから生やす。
    let below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
    if (!below) return;
    if (MEADOW_SOIL.has(below.typeId)) {
      setBlock(dim, { x: loc.x, y: loc.y - 1, z: loc.z }, "minecraft:grass_block");
      below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
    }
    if (!below || below.typeId !== "minecraft:grass_block") return;
    if (Math.random() > 0.5) return;
    trySetBlock(dim, loc, pick(MEADOW_PLANTS));
  });
  scatter(dimension, "minecraft:villager_happy", center, { count: 16, radius: 6, height: 2 });
  sound(dimension, "item.bone_meal.use", center);
}

export function desertEffect(dimension, center) {
  applyEffects(dimension, center, 6, [["minecraft:blindness", 40, 0]]);
  if (!mayBreakBlocks()) return;
  scanDisk(dimension, center, { radius: 5, layers: [-1, -1], name: "desert" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (block && (block.typeId === "minecraft:grass_block" || block.typeId === "minecraft:dirt")) {
      block.setType("minecraft:sand");
    }
    if (Math.random() < 0.08) trySetBlock(dim, { x: loc.x, y: loc.y + 1, z: loc.z }, ["minecraft:cactus"]);
  });
  scatter(dimension, "minecraft:basic_smoke_particle", center, { count: 14, radius: 5, height: 2 });
}

export function cactusEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  const SOFT_GROUND = new Set([
    "minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol",
  ]);
  scanDisk(dimension, center, { radius: 4, layers: [0, 0], name: "cactus" }, (dim, loc) => {
    if (Math.random() > 0.35) return;
    const here = blockAt(dim, loc);
    if (!here || here.typeId !== "minecraft:air") return;

    // サボテンは砂の上にしか置けない。草原で使っても一本も生えないのでは
    // 意味が無いので、土や草なら先に砂へ変える。
    const groundLoc = { x: loc.x, y: loc.y - 1, z: loc.z };
    const below = blockAt(dim, groundLoc);
    if (!below) return;
    if (SOFT_GROUND.has(below.typeId)) setBlock(dim, groundLoc, "minecraft:sand");

    const ground = blockAt(dim, groundLoc);
    if (ground && (ground.typeId === "minecraft:sand" || ground.typeId === "minecraft:red_sand")) {
      trySetBlock(dim, loc, ["minecraft:cactus"]);
    }
  });
}

export function honeyEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  scanDisk(dimension, center, { radius: 3, layers: [0, 1], name: "honey" }, (dim, loc) => {
    if (Math.random() > 0.6) return;
    const block = blockAt(dim, loc);
    if (block && block.typeId === "minecraft:air") trySetBlock(dim, loc, ["minecraft:honey_block"]);
  });
  sound(dimension, "place.honey_block", center);
}

/* ------------------------------------------------------------------ */
/*  建てる・掘る                                                       */
/* ------------------------------------------------------------------ */

/** そのまま置き換えると見栄えが良くなるブロック。IDの揺れに備えて候補を並べてある */
export const BUILD_UPGRADES = {
  "minecraft:cobblestone": ["minecraft:stone_bricks", "minecraft:stonebrick"],
  "minecraft:stone": ["minecraft:stone_bricks", "minecraft:stonebrick"],
  "minecraft:cobbled_deepslate": ["minecraft:deepslate_bricks"],
  "minecraft:gravel": ["minecraft:cobblestone"],
  "minecraft:dirt": ["minecraft:dirt_path", "minecraft:grass_path"],
  "minecraft:coarse_dirt": ["minecraft:dirt_path", "minecraft:grass_path"],
  "minecraft:grass_block": ["minecraft:dirt_path", "minecraft:grass_path"],
  "minecraft:sand": ["minecraft:sandstone"],
  "minecraft:red_sand": ["minecraft:red_sandstone"],
  "minecraft:netherrack": ["minecraft:nether_brick", "minecraft:nether_bricks"],
  "minecraft:oak_log": ["minecraft:oak_planks"],
  "minecraft:spruce_log": ["minecraft:spruce_planks"],
  "minecraft:birch_log": ["minecraft:birch_planks"],
  "minecraft:jungle_log": ["minecraft:jungle_planks"],
  "minecraft:acacia_log": ["minecraft:acacia_planks"],
  "minecraft:dark_oak_log": ["minecraft:dark_oak_planks"],
};

export function builderEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  scanDisk(dimension, center, { radius: 5, layers: [-1, -1], name: "builder" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    const upgrade = block && BUILD_UPGRADES[block.typeId];
    if (upgrade) trySetBlock(dim, loc, upgrade);
  });
  sound(dimension, "random.anvil_use", center);
  scatter(dimension, "minecraft:basic_crit_particle", center, { count: 14, radius: 5, height: 2 });
}

export function shaftEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  const limits = heightLimits(dimension);
  // 岩盤の少し上まで。掘る量が青天井にならないよう深さにも上限を設ける
  const depth = Math.min(40, Math.max(1, Math.floor(center.y) - limits.min - 5));
  carveShaft(dimension, center, { radius: 1, top: 0, bottom: -depth, priority: 2 });
  sound(dimension, "random.explode", center, { pitch: 0.7 });
}

export function obsidianEffect(dimension, center) {
  if (!mayBreakBlocks()) return;

  // 1) 周囲の溶岩を黒曜石に変える
  scanSphere(dimension, center, { radius: 5, name: "obsidian:lava" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (block && (block.typeId === "minecraft:lava" || block.typeId === "minecraft:flowing_lava")) {
      block.setType("minecraft:obsidian");
    }
  });

  // 2) 爆心地を黒曜石の殻で包む。溶岩の無い場所で使っても何か起きるように。
  //    空いている場所だけを埋めるので、既存の建築は壊さない。
  scanSphere(dimension, center, { radius: 4, name: "obsidian:shell" }, (dim, loc) => {
    const d2 = (loc.x - Math.floor(center.x)) ** 2 + (loc.y - Math.floor(center.y)) ** 2 +
               (loc.z - Math.floor(center.z)) ** 2;
    if (d2 < 9) return; // 中身は空けておく
    const block = blockAt(dim, loc);
    if (!block) return;
    const id = block.typeId;
    if (id === "minecraft:air" || id === "minecraft:water" || id === "minecraft:flowing_water") {
      block.setType("minecraft:obsidian");
    }
  });
  sound(dimension, "random.anvil_land", center);
}

/* ------------------------------------------------------------------ */
/*  収穫と製錬                                                         */
/* ------------------------------------------------------------------ */

/*
 * 作物ごとの「成長度」を表す状態名と、その最大値。
 * 統合版ではビートルートも growth 0〜7 で、ネザーウォートだけは
 * growth ではなく age 0〜3 を使う。どちらも growth の 3 を上限にすると
 * ビートルートは中途半端にしか育たず、ネザーウォートは一切育たない。
 */
export const CROP_STATES = {
  "minecraft:wheat": { state: "growth", max: 7 },
  "minecraft:carrots": { state: "growth", max: 7 },
  "minecraft:potatoes": { state: "growth", max: 7 },
  "minecraft:beetroot": { state: "growth", max: 7 },
  "minecraft:pumpkin_stem": { state: "growth", max: 7 },
  "minecraft:melon_stem": { state: "growth", max: 7 },
  "minecraft:sweet_berry_bush": { state: "growth", max: 3 },
  "minecraft:nether_wart": { state: "age", max: 3 },
  "minecraft:cocoa": { state: "age", max: 2 },
};

export function harvestEffect(dimension, center) {
  // 畑がTNTと同じ高さとは限らないので、上下1ブロックも見る
  scanDisk(dimension, center, { radius: 6, layers: [-1, 1], name: "harvest" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (!block) return;
    const crop = CROP_STATES[block.typeId];
    if (!crop) return;
    const current = block.permutation.getState(crop.state);
    if (current !== undefined && current < crop.max) {
      block.setPermutation(block.permutation.withState(crop.state, crop.max));
    }
  });
  scatter(dimension, "minecraft:villager_happy", center, { count: 18, radius: 6, height: 2 });
  sound(dimension, "item.bone_meal.use", center);
}

/** その場で焼けて、アイテムとして落ちるもの */
export const SMELT_TO_ITEM = {
  "minecraft:iron_ore": "minecraft:iron_ingot",
  "minecraft:deepslate_iron_ore": "minecraft:iron_ingot",
  "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:deepslate_gold_ore": "minecraft:gold_ingot",
  "minecraft:copper_ore": "minecraft:copper_ingot",
  "minecraft:deepslate_copper_ore": "minecraft:copper_ingot",
  "minecraft:ancient_debris": "minecraft:netherite_scrap",
  "minecraft:nether_gold_ore": "minecraft:gold_ingot",
};

/** その場で焼き固まって、ブロックのまま残るもの */
export const SMELT_TO_BLOCK = {
  "minecraft:sand": ["minecraft:glass"],
  "minecraft:red_sand": ["minecraft:glass"],
  "minecraft:cobblestone": ["minecraft:stone"],
  "minecraft:cobbled_deepslate": ["minecraft:deepslate"],
  "minecraft:clay": ["minecraft:terracotta", "minecraft:hardened_clay"],
  "minecraft:wet_sponge": ["minecraft:sponge"],
};

export function smelterEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  scanSphere(dimension, center, { radius: 6, name: "smelter" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (!block) return;
    const drop = SMELT_TO_ITEM[block.typeId];
    if (drop) {
      block.setType("minecraft:air");
      dropItem(dim, new ItemStack(drop, 1), loc);
      return;
    }
    const baked = SMELT_TO_BLOCK[block.typeId];
    if (baked) trySetBlock(dim, loc, baked);
  });
  sound(dimension, "random.fizz", center);
  later(6, () => scatter(dimension, "minecraft:basic_flame_particle", center, { count: 14, radius: 5, height: 3 }));
}
