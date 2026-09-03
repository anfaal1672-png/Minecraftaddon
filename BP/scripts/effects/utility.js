/**
 * 役に立つTNT。回復・収集・照明など。
 */
import { ItemStack, world } from "@minecraft/server";
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, trySetBlock } from "../lib/blocks.js";
import { scanDisk } from "../lib/terrain.js";
import { applyEffects, dropItem, spawn } from "../lib/entities.js";
import { later, scatter, sound } from "../lib/fx.js";
import { pick, randomInDisk } from "../lib/math.js";

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
