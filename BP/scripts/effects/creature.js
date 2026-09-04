/**
 * モブを呼び出すTNT。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { scanDisk } from "../lib/terrain.js";
import { blockAt, setIfEmpty, trySetBlock } from "../lib/blocks.js";
import { addEffect, applyEffects, entitiesNear, locationOf, push, spawn } from "../lib/entities.js";
import { later, pillar, scatter, sound } from "../lib/fx.js";
import { horizontalDirection, pick, randomInDisk } from "../lib/math.js";

export const HOSTILE_MOBS = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider"];
export const FARM_ANIMALS = ["minecraft:chicken", "minecraft:cow", "minecraft:pig", "minecraft:sheep"];

export function summonEffect(dimension, center) {
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    later(i * 3, () => {
      spawn(dimension, pick(HOSTILE_MOBS), randomInDisk(center, 2.5));
      sound(dimension, "mob.zombie.say", center, { pitch: 0.8 + Math.random() * 0.4 });
    });
  }
}

export function snowgolemEffect(dimension, center) {
  for (let i = 0; i < 2; i++) spawn(dimension, "minecraft:snow_golem", randomInDisk(center, 1.5));
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 4, layers: [0, 0], name: "snowgolem" }, (dim, loc) => {
      if (Math.random() > 0.5) return;
      const block = blockAt(dim, loc);
      if (block && block.typeId === "minecraft:air") trySetBlock(dim, loc, ["minecraft:snow_layer"]);
    });
  }
  sound(dimension, "mob.snowgolem.death", center, { pitch: 1.4 });
}

export function beeEffect(dimension, center) {
  for (let i = 0; i < 4; i++) spawn(dimension, "minecraft:bee", randomInDisk({ ...center, y: center.y + 1 }, 1.5));
  applyEffects(dimension, center, 5, [["minecraft:poison", 40, 0, true]]);
  sound(dimension, "mob.bee.aggressive", center);
}

export function animalEffect(dimension, center) {
  for (let i = 0; i < 5; i++) spawn(dimension, pick(FARM_ANIMALS), randomInDisk(center, 2));
  sound(dimension, "mob.cow.say", center);
}

/**
 * UFO襲来TNT。緑の光の柱が降りてきて、その中のものを空へ持ち上げる。
 */
export function ufoEffect(dimension, center) {
  announce("§a§l👽 UFO襲来TNT: 光の柱が降りてきた 👽§r");
  applyEffects(dimension, center, 7, [
    ["minecraft:levitation", 100, 2, true],
    ["minecraft:slowness", 100, 2],
    // 持ち上げた責任は取る
    ["minecraft:slow_falling", 220, 0],
  ]);
  sound(dimension, "beacon.activate", center);
  pillar(dimension, "minecraft:witchspell_emitter", center, { height: 20, step: 2, spread: 0.8, perStep: 2 });
}

/* ------------------------------------------------------------------ */
/*  ネコ・村人・ゴーレム・ファントム                                    */
/* ------------------------------------------------------------------ */

export function catEffect(dimension, center) {
  announce("§6🐈 ネコTNT: クリーパーが逃げていく 🐈§r");
  for (let i = 0; i < 8; i++) {
    later(i * 2, () => spawn(dimension, "minecraft:cat", randomInDisk(center, 3)));
  }
  // クリーパーはネコを怖がる。実際に追い払う
  for (const ent of entitiesNear(dimension, center, 16, { items: false })) {
    if (ent.typeId !== "minecraft:creeper") continue;
    const loc = locationOf(ent);
    if (!loc) continue;
    const dir = horizontalDirection(center, loc);
    push(ent, { x: dir.x * 2.0, y: 0.5, z: dir.z * 2.0 });
    addEffect(ent, "minecraft:speed", 200, { amplifier: 2 });
  }
  sound(dimension, "mob.cat.meow", center);
  scatter(dimension, "minecraft:heart_particle", center, { count: 14, radius: 3, height: 2 });
}

/** 村人と一緒に置く取引台 */
export const WORKSTATIONS = [
  "minecraft:composter", "minecraft:barrel", "minecraft:smoker", "minecraft:fletching_table",
  "minecraft:cartography_table", "minecraft:loom", "minecraft:lectern", "minecraft:grindstone",
];

export function villagerEffect(dimension, center) {
  announce("§a🏘 村人TNT: 即席の村ができた 🏘§r");
  for (let i = 0; i < 5; i++) {
    later(i * 3, () => spawn(dimension, "minecraft:villager", randomInDisk(center, 3)));
  }
  if (mayBreakBlocks()) {
    // 取引台をぐるりと並べる
    WORKSTATIONS.forEach((station, i) => {
      const angle = (Math.PI * 2 * i) / WORKSTATIONS.length;
      const loc = {
        x: Math.floor(center.x + Math.cos(angle) * 4),
        y: Math.floor(center.y),
        z: Math.floor(center.z + Math.sin(angle) * 4),
      };
      setIfEmpty(dimension, loc, station);
    });
    setIfEmpty(dimension, { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) }, "minecraft:bell");
  }
  sound(dimension, "mob.villager.idle", center);
}

export function golemEffect(dimension, center) {
  announce("§7🛡 ゴーレムTNT: 守り手が現れた 🛡§r");
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4;
    later(i * 4, () => {
      spawn(dimension, "minecraft:iron_golem", {
        x: center.x + Math.cos(angle) * 3,
        y: center.y,
        z: center.z + Math.sin(angle) * 3,
      });
      sound(dimension, "mob.irongolem.throw", center);
    });
  }
  scatter(dimension, "minecraft:basic_crit_particle", center, { count: 16, radius: 4, height: 2 });
}

export function phantomEffect(dimension, center) {
  announce("§9👁 ファントムTNT: 夜が降りてきた 👁§r");
  try {
    dimension.runCommand("time set midnight");
  } catch (err) {}
  for (let i = 0; i < 6; i++) {
    later(i * 5, () => {
      spawn(dimension, "minecraft:phantom", randomInDisk({ ...center, y: center.y + 12 }, 6));
      sound(dimension, "mob.phantom.idle", center, { pitch: 0.8 + Math.random() * 0.4 });
    });
  }
  applyEffects(dimension, center, 12, [["minecraft:blindness", 60, 0]]);
}
