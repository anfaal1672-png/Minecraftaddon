/**
 * 役に立つTNT。回復・収集・照明など。
 */
import { ItemStack, world } from "@minecraft/server";
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, setBlock, setIfEmpty, trySetBlock } from "../lib/blocks.js";
import { scanDisk, scanSphere } from "../lib/terrain.js";
import { applyEffects, dropItem, spawn } from "../lib/entities.js";
import { later, pillar, scatter, sound } from "../lib/fx.js";
import { blockPos, pick, randomInDisk } from "../lib/math.js";

export function healEffect(dimension, center) {
  applyEffects(dimension, center, 6, [
    ["minecraft:regeneration", 100, 2, true],
    ["minecraft:absorption", 200, 1],
    ["minecraft:instant_health", 1, 1, true],
  ]);
  scatter(dimension, "minecraft:heart_particle", center, { count: 12, radius: 3, height: 2 });
  sound(dimension, "random.levelup", center, { pitch: 1.2 });
}

export function feastEffect(dimension, center) {
  applyEffects(dimension, center, 6, [["minecraft:saturation", 20, 4]]);
  const FOODS = ["minecraft:bread", "minecraft:cooked_beef", "minecraft:apple", "minecraft:cooked_porkchop"];
  for (let i = 0; i < 6; i++) {
    dropItem(dimension, new ItemStack(pick(FOODS), 1), randomInDisk(center, 1.5, 1));
  }
  sound(dimension, "random.burp", center);
}

export const TREASURE_ITEMS = ["minecraft:emerald", "minecraft:gold_ingot", "minecraft:diamond", "minecraft:iron_ingot"];

export function treasureEffect(dimension, center) {
  for (let i = 0; i < 8; i++) {
    const stack = new ItemStack(pick(TREASURE_ITEMS), 1 + Math.floor(Math.random() * 3));
    dropItem(dimension, stack, randomInDisk(center, 1, 1), {
      x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3,
    });
  }
  sound(dimension, "random.levelup", center);
  scatter(dimension, "minecraft:villager_happy", center, { count: 14, radius: 2, height: 2 });
}

export function xpEffect(dimension, center) {
  for (let i = 0; i < 10; i++) {
    later(i * 2, () => spawn(dimension, "minecraft:xp_orb", randomInDisk(center, 1, 1)));
  }
  sound(dimension, "random.orb", center);
}

export const JACKPOT_ITEMS = ["minecraft:diamond", "minecraft:emerald", "minecraft:netherite_scrap"];

export function fortuneEffect(dimension, center) {
  if (Math.random() < 0.5) {
    announce("§6★ 大当たり！お宝の雨だ！★§r");
    for (let i = 0; i < 10; i++) {
      const stack = new ItemStack(pick(JACKPOT_ITEMS), 1 + Math.floor(Math.random() * 2));
      dropItem(dimension, stack, randomInDisk({ ...center, y: center.y + 1 }, 1), {
        x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3,
      });
    }
    sound(dimension, "random.levelup", center);
    return;
  }

  announce("§8はずれ...呪われてしまった§r");
  // 統合版に "unluck" は無く、呼ぶと例外になって何も付かない
  applyEffects(dimension, center, 5, [
    ["minecraft:weakness", 200, 1],
    ["minecraft:mining_fatigue", 200, 1],
  ]);
  sound(dimension, "mob.wither.hurt", center, { pitch: 0.6 });
}

export function invisibilityEffect(dimension, center) {
  applyEffects(dimension, center, 6, [["minecraft:invisibility", 200, 0]]);
  scatter(dimension, "minecraft:basic_smoke_particle", center, { count: 12, radius: 3, height: 2 });
  sound(dimension, "mob.endermen.portal", center, { pitch: 1.4 });
}

export function glowEffect(dimension, center) {
  // 統合版に "glowing" の効果は無いので、暗視と実際の光源で明るくする
  applyEffects(dimension, center, 8, [["minecraft:night_vision", 600, 0]]);
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 5, layers: [0, 2], name: "glow" }, (dim, loc) => {
      if (Math.random() > 0.04) return;
      const block = blockAt(dim, loc);
      if (block && block.typeId === "minecraft:air") trySetBlock(dim, loc, ["minecraft:glowstone"]);
    });
  }
  sound(dimension, "beacon.power", center);
}

export function webEffect(dimension, center) {
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 2, layers: [0, 2], name: "web" }, (dim, loc) => {
      if (Math.random() > 0.5) return;
      const block = blockAt(dim, loc);
      if (block && block.typeId === "minecraft:air") trySetBlock(dim, loc, ["minecraft:web", "minecraft:cobweb"]);
    });
  }
  applyEffects(dimension, center, 4, [["minecraft:slowness", 100, 2]]);
  sound(dimension, "mob.spider.say", center);
}

export function daynightEffect(dimension, center) {
  let moved = false;
  try {
    const now = world.getTimeOfDay();
    world.setTimeOfDay(now < 13000 ? 13000 : 0);
    moved = true;
  } catch (err) {
    moved = false;
  }
  if (!moved) {
    try {
      dimension.runCommand("time set night");
    } catch (err) {}
  }
  sound(dimension, "random.orb", center);
  scatter(dimension, "minecraft:endrod", center, { count: 14, radius: 3, height: 3 });
}

/* ------------------------------------------------------------------ */
/*  補給・松明・ビーコン・測量                                          */
/* ------------------------------------------------------------------ */

/** 補給チェストに入れるもの */
export const SUPPLY_ITEMS = [
  ["minecraft:bread", 8], ["minecraft:cooked_beef", 6], ["minecraft:torch", 32],
  ["minecraft:iron_pickaxe", 1], ["minecraft:iron_sword", 1], ["minecraft:iron_ingot", 8],
  ["minecraft:oak_planks", 32], ["minecraft:golden_apple", 1],
];

export function supplyEffect(dimension, center) {
  announce("§6📦 補給TNT: 物資が届いた 📦§r");
  // チェストを置ければそこへ、置けなければその場にばら撒く
  const base = blockPos(center);
  const placed = mayBreakBlocks() && setIfEmpty(dimension, base, "minecraft:chest");
  const container = placed ? containerAt(dimension, base) : null;

  for (const [itemId, amount] of SUPPLY_ITEMS) {
    const stack = new ItemStack(itemId, amount);
    if (container) {
      try {
        container.addItem(stack);
        continue;
      } catch (err) {
        /* 入らなければ落とす */
      }
    }
    dropItem(dimension, stack, randomInDisk(center, 1.5, 1));
  }
  sound(dimension, "random.levelup", center, { pitch: 0.8 });
  scatter(dimension, "minecraft:villager_happy", center, { count: 14, radius: 2, height: 2 });
}

/** その座標のチェストの中身。取れなければ null */
function containerAt(dimension, loc) {
  try {
    return dimension.getBlock(loc)?.getComponent("minecraft:inventory")?.container ?? null;
  } catch (err) {
    return null;
  }
}

export function torchEffect(dimension, center) {
  announce("§e🔦 松明TNT: 湧き潰しが終わった 🔦§r");
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 12, layers: [0, 0], name: "torch" }, (dim, loc) => {
      // 6マス間隔くらいで並べると、ちょうど湧き潰しになる
      if ((loc.x % 6 !== 0) || (loc.z % 6 !== 0)) return;
      const block = blockAt(dim, loc);
      if (!block || block.typeId !== "minecraft:air") return;
      const below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
      if (!below || below.typeId === "minecraft:air") return;
      trySetBlock(dim, loc, ["minecraft:torch"]);
    });
  }
  applyEffects(dimension, center, 12, [["minecraft:night_vision", 400, 0]]);
  sound(dimension, "random.fizz", center, { pitch: 1.4 });
}

export function beaconEffect(dimension, center) {
  announce("§b🗼 ビーコンTNT: 光の柱が立った 🗼§r");
  if (mayBreakBlocks()) {
    const base = blockPos(center);
    // 3×3 の台座を敷いてから、その上にビーコンを置く
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(dimension, { x: base.x + dx, y: base.y - 1, z: base.z + dz }, "minecraft:iron_block");
      }
    }
    setBlock(dimension, base, "minecraft:beacon");
    // 光を遮らないように上を空ける
    for (let dy = 1; dy <= 6; dy++) {
      const block = blockAt(dimension, { x: base.x, y: base.y + dy, z: base.z });
      if (block && block.typeId !== "minecraft:air") block.setType("minecraft:air");
    }
  }
  applyEffects(dimension, center, 20, [["minecraft:haste", 600, 1]]);
  pillar(dimension, "minecraft:endrod", center, { height: 24, step: 1, spread: 0.4, perStep: 2 });
  sound(dimension, "beacon.activate", center, { volume: 2 });
}

/** 測量で数える鉱石 */
export const SURVEY_ORES = {
  "minecraft:diamond_ore": "ダイヤ", "minecraft:deepslate_diamond_ore": "ダイヤ",
  "minecraft:gold_ore": "金", "minecraft:deepslate_gold_ore": "金",
  "minecraft:iron_ore": "鉄", "minecraft:deepslate_iron_ore": "鉄",
  "minecraft:redstone_ore": "レッドストーン", "minecraft:deepslate_redstone_ore": "レッドストーン",
  "minecraft:lapis_ore": "ラピス", "minecraft:deepslate_lapis_ore": "ラピス",
  "minecraft:emerald_ore": "エメラルド", "minecraft:deepslate_emerald_ore": "エメラルド",
  "minecraft:coal_ore": "石炭", "minecraft:deepslate_coal_ore": "石炭",
  "minecraft:copper_ore": "銅", "minecraft:deepslate_copper_ore": "銅",
  "minecraft:ancient_debris": "古代の残骸",
};

/**
 * 測量TNT。何も壊さずに周囲を調べ、埋まっている鉱石を数えて報告する。
 * 掘る前にどこを掘るか決めたいときのためのもの。
 */
export function surveyEffect(dimension, center) {
  const found = new Map();
  scanSphere(dimension, center, { radius: 14, name: "survey", priority: 2 }, (dim, loc) => {
    const block = blockAt(dim, loc);
    const label = block && SURVEY_ORES[block.typeId];
    if (label) found.set(label, (found.get(label) ?? 0) + 1);
  });

  // 走査はジョブなので、終わったころに読み上げる
  later(60, () => {
    if (found.size === 0) {
      announce("§7🔍 測量TNT: 半径14に鉱石は見つからなかった§r");
    } else {
      const summary = [...found.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `${label}×${count}`)
        .join("、");
      announce(`§b🔍 測量TNT: 半径14の中に §f${summary}§b があった§r`);
    }
  });
  applyEffects(dimension, center, 12, [["minecraft:night_vision", 400, 0]]);
  pillar(dimension, "minecraft:endrod", center, { height: 12, step: 1, spread: 1.2 });
  sound(dimension, "random.orb", center, { pitch: 1.2 });
}
