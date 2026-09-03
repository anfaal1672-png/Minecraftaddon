/**
 * モブを呼び出すTNT。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { scanDisk } from "../lib/terrain.js";
import { blockAt, trySetBlock } from "../lib/blocks.js";
import { applyEffects, spawn } from "../lib/entities.js";
import { later, pillar, sound } from "../lib/fx.js";
import { pick, randomInDisk } from "../lib/math.js";

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
