import { system, WeatherType } from "@minecraft/server";
import { queueExplosion } from "../core/scheduler.js";
import { getBlock, isAir, isLiquidType, placeBlock, terrainAllowed } from "../core/safety.js";
import { nearbyEntities, addEffect, knockbackFrom, spawnEntitySafe } from "../core/entities.js";
import { getSettings } from "../systems/settings.js";
import { announce, msg } from "../systems/i18n.js";
import { attempt } from "../util/log.js";
import { floorLoc } from "../util/math.js";
import { burst, discLocs, forEachBlock, particle, sound, spellColor, below } from "./common.js";

/* ------------------------------------------------------------------ */
/*  属性系TNTの効果                                                    */
/* ------------------------------------------------------------------ */
const WATER = new Set(["minecraft:water", "minecraft:flowing_water"]);
const LAVA = new Set(["minecraft:lava", "minecraft:flowing_lava"]);

function solidBelow(dimension, loc) {
  const b = getBlock(dimension, below(loc));
  return !!b && !isAir(b) && !isLiquidType(b.typeId);
}

export function iceEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) addEffect(ent, "minecraft:slowness", 100, 3, true);
  forEachBlock("ice", dimension, discLocs(center, 4, -2, 2), (b, loc) => {
    if (WATER.has(b.typeId)) b.setType("minecraft:ice");
    else if (isAir(b) && Math.random() < 0.25 && solidBelow(dimension, loc)) b.setType("minecraft:snow_layer");
  });
  burst(dimension, "minecraft:snowflake_particle", center, 10, 6);
}

export function poisonEffect(dimension, center) {
  const green = spellColor(0.3, 0.7, 0.1);
  let rounds = 0;
  const id = system.runInterval(() => {
    rounds++;
    for (const ent of nearbyEntities(dimension, center, 6)) addEffect(ent, "minecraft:poison", 60, 1, true);
    burst(dimension, "minecraft:mob_spell_particle", center, 6, 6, 2, green);
    if (rounds >= 5) system.clearRun(id);
  }, 20);
}

/** 火をつける。安全モード中は何もしない */
export function fireEffect(dimension, center, opts) {
  const R = opts?.radius ?? 4;
  if (!terrainAllowed()) return;
  const locs = [];
  for (const loc of discLocs(center, R)) if (Math.random() < 0.35) locs.push(loc);
  forEachBlock("fire", dimension, locs, (b, loc) => {
    const under = getBlock(dimension, below(loc));
    if (isAir(b) && under && !isAir(under) && !isLiquidType(under.typeId)) b.setType("minecraft:fire");
  });
}

export function thunderEffect(dimension, center) {
  for (let i = 0; i < 6; i++) {
    system.runTimeout(() => {
      spawnEntitySafe(dimension, "minecraft:lightning_bolt", {
        x: center.x + (Math.random() - 0.5) * 10,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 10,
      });
    }, i * 3);
  }
}

/** 溶岩を撒く。空気・草花の場所にだけ置く (安全モード中は置かない) */
export function lavaEffect(dimension, center) {
  const base = floorLoc(center);
  placeBlock(dimension, base, "minecraft:lava", { destructive: true });
  for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (Math.random() < 0.5) placeBlock(dimension, { x: base.x + o[0], y: base.y, z: base.z + o[1] }, "minecraft:lava", { destructive: true });
  }
  for (const ent of nearbyEntities(dimension, center, 5)) attempt("setOnFire", () => ent.setOnFire(6, true));
}

export function waterEffect(dimension, center) {
  const base = floorLoc(center);
  placeBlock(dimension, base, "minecraft:water");
  for (const ent of nearbyEntities(dimension, center, 6, "all")) {
    attempt("extinguish", () => ent.extinguishFire(true));
    knockbackFrom(ent, center, 0.8, 0.3);
  }
  forEachBlock("water", dimension, discLocs(center, 3), (b) => {
    if (b.typeId === "minecraft:fire" || b.typeId === "minecraft:soul_fire") b.setType("minecraft:air");
  });
}

export function darknessEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 7)) {
    addEffect(ent, "minecraft:blindness", 100, 0);
    addEffect(ent, "minecraft:nausea", 60, 1);
  }
  burst(dimension, "minecraft:basic_smoke_particle", center, 10);
}

export function curseEffect(dimension, center) {
  announce(msg("curse"));
  for (const ent of nearbyEntities(dimension, center, 6)) {
    addEffect(ent, "minecraft:weakness", 200, 1);
    addEffect(ent, "minecraft:slowness", 160, 1);
    addEffect(ent, "minecraft:hunger", 200, 1);
    addEffect(ent, "minecraft:darkness", 100, 0);
  }
  sound(dimension, "mob.wither.death", center);
  burst(dimension, "minecraft:mob_spell_particle", center, 14, 4, 2.5, spellColor(0.2, 0.05, 0.25));
}

export function confusionEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    addEffect(ent, "minecraft:nausea", 160, 2);
    addEffect(ent, "minecraft:slowness", 80, 1);
  }
  burst(dimension, "minecraft:mob_spell_particle", center, 10, 3, 2, spellColor(0.6, 0.4, 0.8));
}

/** 嵐TNT (B04: 天候は Dimension.setWeather で変える) */
export function stormEffect(dimension, center) {
  attempt("setWeather", () => dimension.setWeather(WeatherType.Thunder, 6000));
  for (let i = 0; i < 4; i++) {
    system.runTimeout(() => {
      spawnEntitySafe(dimension, "minecraft:lightning_bolt", {
        x: center.x + (Math.random() - 0.5) * 8,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 8,
      });
    }, i * 4);
  }
}

export function scorchedEffect(dimension, center) {
  forEachBlock("scorched", dimension, discLocs(center, 5, -1, -1), (b) => {
    if (b.typeId === "minecraft:grass_block" || b.typeId === "minecraft:dirt") {
      b.setType(Math.random() < 0.3 ? "minecraft:netherrack" : "minecraft:coarse_dirt");
    }
  });
}

export function iceageEffect(dimension, center) {
  forEachBlock("iceage", dimension, discLocs(center, 7, -1, 2), (b, loc) => {
    if (WATER.has(b.typeId)) b.setType("minecraft:ice");
    else if (isAir(b) && Math.random() < 0.3 && solidBelow(dimension, loc)) b.setType("minecraft:snow_layer");
  });
  for (const ent of nearbyEntities(dimension, center, 8)) addEffect(ent, "minecraft:slowness", 200, 4, true);
}

/**
 * 津波TNT: 一時的に水を置いて押し流し、5秒後に「自分が置いた水だけ」を消す (B10)。
 * 元からあった池や川の水には触らない。
 */
export function tsunamiEffect(dimension, center) {
  const placed = [];
  for (const loc of discLocs(center, 5)) {
    if (Math.random() > 0.3) continue;
    if (placeBlock(dimension, loc, "minecraft:water")) placed.push(loc);
  }
  for (const ent of nearbyEntities(dimension, center, 8, "all")) knockbackFrom(ent, center, 1.3, 0.35);
  system.runTimeout(() => {
    forEachBlock("tsunami-cleanup", dimension, placed, (b) => {
      if (WATER.has(b.typeId)) b.setType("minecraft:air");
    });
  }, 100);
}

/** 隕石雨TNT: 炎の軌跡と着弾爆発 */
export function meteorEffect(dimension, center, ctx) {
  announce(msg("meteor"));
  const s = getSettings();
  for (let i = 0; i < 6; i++) {
    const ox = (Math.random() - 0.5) * 14;
    const oz = (Math.random() - 0.5) * 14;
    const startDelay = i * 12;
    const fallSteps = 8;
    for (let st = 0; st < fallSteps; st++) {
      system.runTimeout(() => {
        particle(dimension, "minecraft:basic_flame_particle", { x: center.x + ox, y: center.y + (fallSteps - st) * 2.2, z: center.z + oz });
      }, startDelay + st * 2);
    }
    system.runTimeout(() => {
      queueExplosion(dimension, { x: center.x + ox, y: center.y, z: center.z + oz }, 6 * (ctx?.scale ?? 1), {
        breaksBlocks: s.terrain,
        causesFire: s.terrain,
      });
    }, startDelay + fallSteps * 2 + 2);
  }
}

export { WATER, LAVA };
