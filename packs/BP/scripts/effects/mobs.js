import { system } from "@minecraft/server";
import { isAir, placeBlock } from "../core/safety.js";
import { nearbyEntities, addEffect, spawnEntitySafe } from "../core/entities.js";
import { announce, msg } from "../systems/i18n.js";
import { attempt } from "../util/log.js";
import { pick } from "../util/math.js";
import { discLocs, particle, sound, spellColor } from "./common.js";

/* ------------------------------------------------------------------ */
/*  生き物系TNTの効果                                                  */
/* ------------------------------------------------------------------ */
const around = (center, spread, dy = 0) => ({
  x: center.x + (Math.random() - 0.5) * spread,
  y: center.y + dy,
  z: center.z + (Math.random() - 0.5) * spread,
});

const SUMMON_MOBS = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider"];
export function summonEffect(dimension, center) {
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    system.runTimeout(() => spawnEntitySafe(dimension, pick(SUMMON_MOBS), around(center, 5)), i * 3);
  }
}

export function snowgolemEffect(dimension, center) {
  for (let i = 0; i < 2; i++) spawnEntitySafe(dimension, "minecraft:snow_golem", around(center, 3));
  for (const loc of discLocs(center, 4)) {
    if (Math.random() > 0.5) continue;
    placeBlock(dimension, loc, "minecraft:snow_layer", { canReplace: isAir });
  }
}

export function beeEffect(dimension, center) {
  for (let i = 0; i < 4; i++) spawnEntitySafe(dimension, "minecraft:bee", around(center, 3, 1));
  for (const ent of nearbyEntities(dimension, center, 5)) addEffect(ent, "minecraft:poison", 40, 0, true);
}

export function slimeEffect(dimension, center) {
  for (let i = 0; i < 3; i++) spawnEntitySafe(dimension, "minecraft:slime", around(center, 3));
  for (const ent of nearbyEntities(dimension, center, 5, "all")) attempt("slimeBounce", () => ent.applyImpulse({ x: 0, y: 0.8, z: 0 }));
}

const FRIENDLY_ANIMALS = ["minecraft:chicken", "minecraft:cow", "minecraft:pig", "minecraft:sheep"];
export function animalEffect(dimension, center) {
  for (let i = 0; i < 5; i++) spawnEntitySafe(dimension, pick(FRIENDLY_ANIMALS), around(center, 4));
}

/** UFO襲来TNT: 緑の光の柱と共に周囲を空へ持ち上げる */
export function ufoEffect(dimension, center) {
  announce(msg("ufo"));
  for (const ent of nearbyEntities(dimension, center, 7)) {
    addEffect(ent, "minecraft:levitation", 100, 2, true);
    addEffect(ent, "minecraft:slowness", 100, 2);
  }
  sound(dimension, "beacon.activate", center);
  const green = spellColor(0.2, 1, 0.4);
  for (let h = 0; h < 20; h++) {
    system.runTimeout(() => {
      particle(
        dimension,
        "minecraft:mob_spell_particle",
        { x: center.x + (Math.random() - 0.5) * 0.8, y: center.y + h * 0.8, z: center.z + (Math.random() - 0.5) * 0.8 },
        green
      );
    }, h * 2);
  }
}
