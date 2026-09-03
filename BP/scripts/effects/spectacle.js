/**
 * アイテムを出すTNTと、演出だけのTNT。
 */
import { system, ItemStack } from "@minecraft/server";
import { announce } from "../core/announce.js";
import { animalEffect, beeEffect, feastEffect, healEffect, snowgolemEffect, summonEffect, webEffect } from "./creatures.js";
import { darknessEffect, fireEffect, glowEffect, iceEffect, lavaEffect, poisonEffect, thunderEffect, tsunamiEffect, waterEffect } from "./elemental.js";
import { antiGravityEffect, bouncyEffect, chorusEffect, confusionEffect, slimeEffect, swapEffect, teleportEffect } from "./motion.js";
import { nukeEffect } from "./nuclear.js";
import { cactusEffect, desertEffect, earthquakeEffect, grassEffect, harvestEffect, honeyEffect } from "./terrain.js";
import { trySetBlock } from "../util/blocks.js";
import { nearbyEntities } from "../util/entities.js";

export const TREASURE_ITEMS = ["minecraft:emerald", "minecraft:gold_ingot", "minecraft:diamond", "minecraft:iron_ingot"];

export function treasureEffect(dimension, center) {
  for (let i = 0; i < 8; i++) {
    try {
      const itemId = TREASURE_ITEMS[Math.floor(Math.random() * TREASURE_ITEMS.length)];
      const stack = new ItemStack(itemId, 1 + Math.floor(Math.random() * 3));
      const item = dimension.spawnItem(stack, {
        x: center.x + (Math.random() - 0.5) * 2,
        y: center.y + 0.5,
        z: center.z + (Math.random() - 0.5) * 2,
      });
      item.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3 });
    } catch (err) {}
  }
  try {
    dimension.playSound("random.levelup", center);
  } catch (err) {}
}

export const TREASURE_JACKPOT = ["minecraft:diamond", "minecraft:emerald", "minecraft:netherite_scrap"];

export function fortuneEffect(dimension, center) {
  if (Math.random() < 0.5) {
    try {
      announce("§6★ 大当たり！お宝の雨だ！★§r");
    } catch (err) {}
    for (let i = 0; i < 10; i++) {
      try {
        const itemId = TREASURE_JACKPOT[Math.floor(Math.random() * TREASURE_JACKPOT.length)];
        const item = dimension.spawnItem(new ItemStack(itemId, 1 + Math.floor(Math.random() * 2)), {
          x: center.x + (Math.random() - 0.5) * 2,
          y: center.y + 1,
          z: center.z + (Math.random() - 0.5) * 2,
        });
        item.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3 });
      } catch (err) {}
    }
  } else {
    try {
      announce("§8はずれ...呪われてしまった§r");
    } catch (err) {}
    for (const ent of nearbyEntities(dimension, center, 5)) {
      try {
        // 統合版に "unluck" は無く、呼ぶと例外になって何も付かなかった
        ent.addEffect("minecraft:weakness", 200, { amplifier: 1, showParticles: false });
        ent.addEffect("minecraft:mining_fatigue", 200, { amplifier: 1, showParticles: false });
      } catch (err) {}
    }
  }
}

export function xpEffect(dimension, center) {
  for (let i = 0; i < 10; i++) {
    system.runTimeout(() => {
      try {
        dimension.spawnEntity("minecraft:xp_orb", {
          x: center.x + (Math.random() - 0.5) * 2,
          y: center.y + 0.5,
          z: center.z + (Math.random() - 0.5) * 2,
        });
      } catch (err) {}
    }, i * 2);
  }
}

export function confettiEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:jump_boost", 200, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:speed", 200, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }
  try {
    dimension.playSound("random.levelup", center);
  } catch (err) {}
  for (let n = 0; n < 16; n++) {
    try {
      dimension.spawnParticle("minecraft:totem_particle", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y + Math.random() * 3,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
  }
}

/**
 * 花火大乱舞TNT: 打ち上げ花火を大量に打ち上げる、無害でド派手な演出TNT。
 */
export function fireworksEffect(dimension, center) {
  try {
    announce("§e✨ 花火大乱舞TNT ✨§r");
  } catch (err) {}
  for (let i = 0; i < 14; i++) {
    system.runTimeout(() => {
      try {
        const loc = {
          x: center.x + (Math.random() - 0.5) * 6,
          y: center.y + Math.random() * 2,
          z: center.z + (Math.random() - 0.5) * 6,
        };
        const rocket = dimension.spawnEntity("minecraft:fireworks_rocket", loc);
        rocket.applyImpulse({ x: (Math.random() - 0.5) * 0.2, y: 1.2 + Math.random() * 0.6, z: (Math.random() - 0.5) * 0.2 });
      } catch (err) {}
    }, i * 3);
  }
}

/**
 * ディスコTNT: 足元を一時的にカラフルな床に変え、音楽と共に踊らせる。
 * 変化させたブロックは元に戻す。
 */
export function discoEffect(dimension, center) {
  try {
    announce("§d♪ ディスコTNTが踊り出した ♪§r");
  } catch (err) {}

  const colors = [
    "minecraft:red_concrete", "minecraft:yellow_concrete", "minecraft:lime_concrete",
    "minecraft:light_blue_concrete", "minecraft:purple_concrete", "minecraft:magenta_concrete",
  ];
  const R = 4;
  const baseY = Math.floor(center.y) - 1;
  const originals = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: baseY, z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (!b || b.typeId === "minecraft:air") continue;
        originals.push({ loc, typeId: b.typeId });
      } catch (err) {}
    }
  }

  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:speed", 140, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:jump_boost", 140, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }

  let beat = 0;
  const beatId = system.runInterval(() => {
    beat++;
    for (const o of originals) {
      try {
        trySetBlock(dimension, o.loc, [colors[Math.floor(Math.random() * colors.length)]]);
      } catch (err) {}
    }
    try {
      dimension.playSound("random.orb", center);
      dimension.spawnParticle("minecraft:totem_particle", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
    if (beat >= 7) {
      system.clearRun(beatId);
      for (const o of originals) {
        try {
          trySetBlock(dimension, o.loc, [o.typeId]);
        } catch (err) {}
      }
    }
  }, 8);
}

export function musicEffect(dimension, center) {
  const notes = [0, 4, 7, 12, 7, 4, 0];
  notes.forEach((n, i) => {
    system.runTimeout(() => {
      try {
        dimension.playSound("note.harp", center, { pitch: Math.pow(2, n / 12) });
        dimension.spawnParticle("minecraft:totem_particle", {
          x: center.x + (Math.random() - 0.5) * 2,
          y: center.y + 1 + Math.random(),
          z: center.z + (Math.random() - 0.5) * 2,
        });
      } catch (err) {}
    }, i * 4);
  });
}

export function rainbowEffect(dimension, center) {
  // 虹TNTは威力6の中堅TNT。ここに nukeEffect が混ざっていたため、
  // 運が悪いと巨大クレーターと放射能汚染まで引き当ててしまっていたので外した。
  const pool = [
    iceEffect, poisonEffect, fireEffect, thunderEffect, teleportEffect,
    healEffect, confettiEffect, antiGravityEffect, lavaEffect, waterEffect,
    darknessEffect, summonEffect, earthquakeEffect, bouncyEffect, webEffect,
    treasureEffect, swapEffect, confusionEffect, grassEffect, desertEffect,
    snowgolemEffect, beeEffect, arrowEffect, musicEffect, tsunamiEffect,
    harvestEffect, xpEffect, slimeEffect, animalEffect, honeyEffect,
    feastEffect, cactusEffect, glowEffect, chorusEffect,
  ];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try {
    announce(`§d虹TNT: ${pick.name} が発動！§r`);
  } catch (err) {}
  pick(dimension, center);
}

export function arrowEffect(dimension, center) {
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    try {
      const arrow = dimension.spawnEntity("minecraft:arrow", {
        x: center.x,
        y: center.y + 1,
        z: center.z,
      });
      arrow.applyImpulse({ x: Math.cos(angle) * 1.2, y: 0.1, z: Math.sin(angle) * 1.2 });
    } catch (err) {}
  }
}
