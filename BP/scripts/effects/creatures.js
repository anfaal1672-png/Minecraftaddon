/**
 * モブを呼ぶTNTと、状態異常をばらまくTNT。
 */
import { system, ItemStack } from "@minecraft/server";
import { announce } from "../core/announce.js";
import { trySetBlock } from "../util/blocks.js";
import { nearbyEntities } from "../util/entities.js";

export const SUMMON_MOBS = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider"];

export function summonEffect(dimension, center) {
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    system.runTimeout(() => {
      try {
        const mob = SUMMON_MOBS[Math.floor(Math.random() * SUMMON_MOBS.length)];
        const x = center.x + (Math.random() - 0.5) * 5;
        const z = center.z + (Math.random() - 0.5) * 5;
        dimension.spawnEntity(mob, { x, y: center.y, z });
      } catch (err) {}
    }, i * 3);
  }
}

export function snowgolemEffect(dimension, center) {
  for (let i = 0; i < 2; i++) {
    try {
      dimension.spawnEntity("minecraft:snow_golem", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R || Math.random() > 0.5) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (b && b.typeId === "minecraft:air") trySetBlock(dimension, loc, ["minecraft:snow_layer"]);
      } catch (err) {}
    }
  }
}

export function beeEffect(dimension, center) {
  for (let i = 0; i < 4; i++) {
    try {
      dimension.spawnEntity("minecraft:bee", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + 1,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
  for (const ent of nearbyEntities(dimension, center, 5)) {
    try {
      ent.addEffect("minecraft:poison", 40, { amplifier: 0, showParticles: true });
    } catch (err) {}
  }
}

export const FRIENDLY_ANIMALS = ["minecraft:chicken", "minecraft:cow", "minecraft:pig", "minecraft:sheep"];

export function animalEffect(dimension, center) {
  for (let i = 0; i < 5; i++) {
    try {
      const mob = FRIENDLY_ANIMALS[Math.floor(Math.random() * FRIENDLY_ANIMALS.length)];
      dimension.spawnEntity(mob, {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
  }
}

/**
 * UFO襲来TNT: 緑の光の柱と共に周囲を空に持ち上げる(浮遊効果)。
 */
export function ufoEffect(dimension, center) {
  try {
    announce("§a§l👽 UFO襲来TNT: 光の柱が降りてきた 👽§r");
  } catch (err) {}

  for (const ent of nearbyEntities(dimension, center, 7)) {
    try {
      ent.addEffect("minecraft:levitation", 100, { amplifier: 2, showParticles: true });
      ent.addEffect("minecraft:slowness", 100, { amplifier: 2, showParticles: false });
    } catch (err) {}
  }

  try {
    dimension.playSound("beacon.activate", center);
  } catch (err) {}

  for (let h = 0; h < 20; h++) {
    system.runTimeout(() => {
      try {
        dimension.spawnParticle("minecraft:mob_spell_particle", {
          x: center.x + (Math.random() - 0.5) * 0.8,
          y: center.y + h * 0.8,
          z: center.z + (Math.random() - 0.5) * 0.8,
        });
      } catch (err) {}
    }, h * 2);
  }
}

export function webEffect(dimension, center) {
  const base = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };
  const R = 2;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = 0; dy <= 2; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (Math.random() > 0.5) continue;
        const loc = { x: base.x + dx, y: base.y + dy, z: base.z + dz };
        try {
          const b = dimension.getBlock(loc);
          if (b && b.typeId === "minecraft:air") {
            trySetBlock(dimension, loc, ["minecraft:web", "minecraft:cobweb"]);
          }
        } catch (err) {}
      }
    }
  }
  for (const ent of nearbyEntities(dimension, center, 4)) {
    try {
      ent.addEffect("minecraft:slowness", 100, { amplifier: 2, showParticles: false });
    } catch (err) {}
  }
}

export function healEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:regeneration", 100, { amplifier: 2, showParticles: true });
      ent.addEffect("minecraft:absorption", 200, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }
  for (let n = 0; n < 8; n++) {
    try {
      dimension.spawnParticle("minecraft:heart_particle", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
}

export function feastEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:saturation", 20, { amplifier: 4, showParticles: false });
    } catch (err) {}
  }
  const FOODS = ["minecraft:bread", "minecraft:cooked_beef", "minecraft:apple", "minecraft:cooked_porkchop"];
  for (let i = 0; i < 6; i++) {
    try {
      dimension.spawnItem(new ItemStack(FOODS[Math.floor(Math.random() * FOODS.length)], 1), {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + 0.5,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
}

/**
 * 呪いTNT: 弱体化の詰め合わせを叩き込む、不穏な雰囲気のTNT。
 */
export function curseEffect(dimension, center) {
  try {
    announce("§8§l☠ 呪いTNTが不吉な力を解き放った ☠§r");
  } catch (err) {}
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:weakness", 200, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:slowness", 160, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:hunger", 200, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:darkness", 100, { amplifier: 0, showParticles: false });
    } catch (err) {}
  }
  try {
    dimension.playSound("mob.wither.death", center);
  } catch (err) {}
  for (let n = 0; n < 14; n++) {
    try {
      dimension.spawnParticle("minecraft:mob_spell_particle", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y + Math.random() * 2.5,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
  }
}

export function invisibilityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:invisibility", 200, { amplifier: 0, showParticles: false });
    } catch (err) {}
  }
}
