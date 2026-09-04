/**
 * 火・水・氷・雷・毒といった、自然の力を撒くTNT。
 */
import { WeatherType } from "@minecraft/server";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, setBlock, setIfEmpty, trySetBlock, WATER_BLOCKS } from "../lib/blocks.js";
import { buildShell, carveSphere, scanDisk, scanSphere } from "../lib/terrain.js";
import { burst, later, repeat, ring, scatter, sound } from "../lib/fx.js";
import { applyEffects, entitiesNear, knockOutward, spawn } from "../lib/entities.js";
import { randomInDisk } from "../lib/math.js";

/* ------------------------------------------------------------------ */
/*  氷と雪                                                             */
/* ------------------------------------------------------------------ */

/** 水を氷に、地面の上を薄雪にする共通処理 */
function freezeArea(dimension, center, { radius, layers, snowChance, name }) {
  if (!mayBreakBlocks()) return;
  scanDisk(dimension, center, { radius, layers, name }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (!block) return;
    if (WATER_BLOCKS.has(block.typeId)) {
      block.setType("minecraft:ice");
      return;
    }
    if (block.typeId !== "minecraft:air" || Math.random() > snowChance) return;
    const below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
    if (below && below.typeId !== "minecraft:air") trySetBlock(dim, loc, ["minecraft:snow_layer"]);
  });
}

export function iceEffect(dimension, center) {
  applyEffects(dimension, center, 6, [["minecraft:slowness", 100, 3, true]]);
  freezeArea(dimension, center, { radius: 4, layers: [-2, 2], snowChance: 0.25, name: "ice" });
  scatter(dimension, "minecraft:snowflake_particle", center, { count: 12, radius: 3, height: 2 });
  sound(dimension, "random.glass", center, { pitch: 1.4 });
}

export function iceageEffect(dimension, center) {
  applyEffects(dimension, center, 8, [["minecraft:slowness", 200, 4, true]]);
  freezeArea(dimension, center, { radius: 7, layers: [-1, 2], snowChance: 0.3, name: "iceage" });
  // 吹雪。上から降りてくるように見せる
  repeat(20, 4, (i) => {
    scatter(dimension, "minecraft:snowflake_particle", { ...center, y: center.y + 3 }, {
      count: 8, radius: 8, height: 2,
    });
    if (i % 5 === 0) sound(dimension, "random.glass", center, { pitch: 0.7 });
  });
}

/* ------------------------------------------------------------------ */
/*  火と溶岩                                                           */
/* ------------------------------------------------------------------ */

/**
 * 地表に火を撒く。核系からも呼ばれる。
 * 火は「空気の下に地面がある」ところにしか置けないので、そこだけ選ぶ。
 */
export function igniteFires(dimension, center, radius = 4, density = 0.35) {
  if (!mayBreakBlocks()) return;
  scanDisk(dimension, center, { radius, layers: [0, 0], name: "fire" }, (dim, loc) => {
    if (Math.random() > density) return;
    const here = blockAt(dim, loc);
    if (!here || here.typeId !== "minecraft:air") return;
    const below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
    if (!below || below.typeId === "minecraft:air" || WATER_BLOCKS.has(below.typeId)) return;
    setBlock(dim, loc, "minecraft:fire");
  });
}

export function fireEffect(dimension, center) {
  igniteFires(dimension, center, 5);
  for (const ent of entitiesNear(dimension, center, 5, { items: false })) {
    try {
      ent.setOnFire(4, true);
    } catch (err) {
      /* 火に強いモブもいる */
    }
  }
  burst(dimension, "minecraft:basic_flame_particle", center, { count: 20, radius: 3 });
  sound(dimension, "mob.ghast.fireball", center);
}

export function lavaEffect(dimension, center) {
  if (mayBreakBlocks()) {
    // 溜まりの形にする。中心は必ず、周りは半分の確率で
    scanDisk(dimension, center, { radius: 2, layers: [0, 0], name: "lava" }, (dim, loc, cell) => {
      if (cell.d2 > 0 && Math.random() < 0.5) return;
      setIfEmpty(dim, loc, "minecraft:lava");
    });
  }
  for (const ent of entitiesNear(dimension, center, 5, { items: false })) {
    try {
      ent.setOnFire(6, true);
    } catch (err) {}
  }
  sound(dimension, "bucket.empty_lava", center);
}

export function scorchedEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  const BURNABLE = new Set([
    "minecraft:grass_block", "minecraft:dirt", "minecraft:podzol",
    "minecraft:mycelium", "minecraft:moss_block", "minecraft:coarse_dirt",
  ]);
  scanDisk(dimension, center, { radius: 5, layers: [-1, -1], name: "scorched" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (!block || !BURNABLE.has(block.typeId)) return;
    block.setType(Math.random() < 0.3 ? "minecraft:netherrack" : "minecraft:coarse_dirt");
  });
  scatter(dimension, "minecraft:basic_smoke_particle", center, { count: 16, radius: 5, height: 2 });
  sound(dimension, "random.fizz", center);
}

/* ------------------------------------------------------------------ */
/*  水                                                                 */
/* ------------------------------------------------------------------ */

export function waterEffect(dimension, center) {
  if (mayBreakBlocks()) {
    setIfEmpty(dimension, center, "minecraft:water");
    // 火を消す
    scanDisk(dimension, center, { radius: 3, layers: [0, 1], name: "water" }, (dim, loc) => {
      const block = blockAt(dim, loc);
      if (block && block.typeId === "minecraft:fire") block.setType("minecraft:air");
    });
  }
  for (const ent of entitiesNear(dimension, center, 6)) {
    try {
      ent.extinguishFire(true);
    } catch (err) {}
  }
  knockOutward(dimension, center, 6, 0.8, { lift: 0.2 });
  sound(dimension, "bucket.empty_water", center);
  scatter(dimension, "minecraft:basic_bubble_particle", center, { count: 14, radius: 3, height: 2 });
}

/**
 * 津波TNT。波が外へ広がり、引き潮で戻る。
 * 引き潮では「自分が置いた水」だけを消す。範囲内の水を無条件に消すと、
 * 海辺や池のそばで使ったときに元からあった水まで消えてしまう。
 */
export function tsunamiEffect(dimension, center) {
  const placed = [];
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 5, layers: [0, 0], name: "tsunami" }, (dim, loc) => {
      if (Math.random() > 0.3) return;
      const block = blockAt(dim, loc);
      if (!block || block.typeId !== "minecraft:air") return;
      if (setBlock(dim, loc, "minecraft:water")) placed.push(loc);
    });
  }
  knockOutward(dimension, center, 8, 1.3, { lift: 0.25 });
  sound(dimension, "ambient.weather.rain", center, { volume: 2 });
  // 外へ広がる波頭
  for (let s = 1; s <= 8; s++) {
    later(s * 3, () => ring(dimension, "minecraft:basic_bubble_particle", center, s, { count: 8 + s * 3, y: 0.6 }));
  }

  later(100, () => {
    for (const loc of placed) {
      const block = blockAt(dimension, loc);
      if (block && block.typeId === "minecraft:water") block.setType("minecraft:air");
    }
  });
}

export function vacuumEffect(dimension, center) {
  if (!mayBreakBlocks()) return;
  scanSphere(dimension, center, { radius: 6, name: "vacuum" }, (dim, loc) => {
    const block = blockAt(dim, loc);
    if (!block) return;
    const id = block.typeId;
    if (id === "minecraft:water" || id === "minecraft:flowing_water" ||
        id === "minecraft:lava" || id === "minecraft:flowing_lava") {
      block.setType("minecraft:air");
    }
  });
  sound(dimension, "random.fizz", center, { pitch: 0.6 });
  scatter(dimension, "minecraft:basic_bubble_particle", center, { count: 20, radius: 6, height: 3 });
}

/* ------------------------------------------------------------------ */
/*  雷と天候                                                           */
/* ------------------------------------------------------------------ */

export function thunderEffect(dimension, center) {
  for (let i = 0; i < 6; i++) {
    later(i * 3, () => spawn(dimension, "minecraft:lightning_bolt", randomInDisk(center, 5)));
  }
}

export function stormEffect(dimension, center) {
  // 天候を変えるのは World ではなく Dimension のほう。
  // 値も文字列ではなく WeatherType の列挙値でなければ例外になり、
  // 嵐TNTなのに天候が一度も変わらないということになる。
  let changed = false;
  try {
    dimension.setWeather(WeatherType.Thunder, 6000);
    changed = true;
  } catch (err) {
    changed = false;
  }
  if (!changed) {
    try {
      dimension.runCommand("weather thunder 300");
    } catch (err) {}
  }
  for (let i = 0; i < 4; i++) {
    later(i * 4, () => spawn(dimension, "minecraft:lightning_bolt", randomInDisk(center, 4)));
  }
}

/* ------------------------------------------------------------------ */
/*  毒と闇                                                             */
/* ------------------------------------------------------------------ */

/** 毒の霧。しばらく居座り、通りかかるたびに毒を重ねる */
export function poisonEffect(dimension, center) {
  repeat(5, 20, () => {
    applyEffects(dimension, center, 6, [["minecraft:poison", 60, 1, true]]);
    scatter(dimension, "minecraft:witchspell_emitter", center, { count: 6, radius: 5, height: 2 });
  });
  sound(dimension, "random.fizz", center);
}

export function darknessEffect(dimension, center) {
  applyEffects(dimension, center, 7, [
    ["minecraft:blindness", 100, 0],
    ["minecraft:nausea", 60, 1],
  ]);
  // 光源を消して、本当に暗くする
  if (mayBreakBlocks()) {
    const LIGHTS = new Set([
      "minecraft:torch", "minecraft:soul_torch", "minecraft:lantern", "minecraft:soul_lantern",
      "minecraft:glowstone", "minecraft:sea_lantern", "minecraft:shroomlight", "minecraft:campfire",
      "minecraft:soul_campfire", "minecraft:redstone_lamp", "minecraft:jack_o_lantern",
    ]);
    scanSphere(dimension, center, { radius: 6, name: "darkness" }, (dim, loc) => {
      const block = blockAt(dim, loc);
      if (block && LIGHTS.has(block.typeId)) block.setType("minecraft:air");
    });
  }
  burst(dimension, "minecraft:basic_smoke_particle", center, { count: 18, radius: 3 });
  sound(dimension, "mob.wither.spawn", center, { volume: 0.6, pitch: 0.5 });
}

/* ------------------------------------------------------------------ */
/*  酸・蒸気・砂・結晶                                                 */
/* ------------------------------------------------------------------ */

/** 酸で溶けたときに何になるか */
export const ACID_MELT = {
  "minecraft:stone": "minecraft:gravel",
  "minecraft:cobblestone": "minecraft:gravel",
  "minecraft:deepslate": "minecraft:cobbled_deepslate",
  "minecraft:cobbled_deepslate": "minecraft:gravel",
  "minecraft:andesite": "minecraft:gravel",
  "minecraft:diorite": "minecraft:gravel",
  "minecraft:granite": "minecraft:gravel",
  "minecraft:gravel": "minecraft:sand",
  "minecraft:sand": "minecraft:air",
  "minecraft:grass_block": "minecraft:coarse_dirt",
  "minecraft:dirt": "minecraft:coarse_dirt",
};

export function acidEffect(dimension, center) {
  applyEffects(dimension, center, 8, [
    ["minecraft:poison", 120, 1, true],
    ["minecraft:weakness", 120, 0],
  ]);
  if (mayBreakBlocks()) {
    // 上から順に溶けていくように、何回かに分けて浸食させる
    repeat(4, 20, () => {
      scanSphere(dimension, center, { radius: 6, name: "acid" }, (dim, loc) => {
        const block = blockAt(dim, loc);
        if (!block) return;
        const melted = ACID_MELT[block.typeId];
        if (melted && Math.random() < 0.35) block.setType(melted);
      });
      scatter(dimension, "minecraft:witchspell_emitter", center, { count: 12, radius: 6, height: 2 });
    });
  }
  sound(dimension, "random.fizz", center, { volume: 2 });
}

export function steamEffect(dimension, center) {
  // 水と熱がぶつかった勢いで、外へ強く押し出す
  knockOutward(dimension, center, 12, 2.6, { lift: 0.9 });
  applyEffects(dimension, center, 12, [["minecraft:slowness", 60, 1]]);
  for (const ent of entitiesNear(dimension, center, 8, { items: false })) {
    try {
      ent.applyDamage(6, { cause: "entityExplosion" });
    } catch (err) {}
  }
  repeat(10, 4, (i) => {
    ring(dimension, "minecraft:basic_bubble_particle", center, 1 + i * 1.2, { count: 12 + i * 2, y: 1 });
    scatter(dimension, "minecraft:campfire_smoke_particle", center, { count: 10, radius: 6, height: 4 });
  });
  sound(dimension, "random.fizz", center, { volume: 3, pitch: 0.7 });
}

export function sandstormEffect(dimension, center) {
  applyEffects(dimension, center, 14, [
    ["minecraft:blindness", 140, 0],
    ["minecraft:slowness", 140, 1],
  ]);
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 10, layers: [0, 1], name: "sandstorm" }, (dim, loc) => {
      if (Math.random() > 0.35) return;
      const block = blockAt(dim, loc);
      if (!block || block.typeId !== "minecraft:air") return;
      const below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
      if (below && below.typeId !== "minecraft:air") trySetBlock(dim, loc, ["minecraft:sand"]);
    });
  }
  // 渦を巻く砂
  repeat(20, 4, (i) => {
    ring(dimension, "minecraft:basic_smoke_particle", center, 2 + (i % 8) * 1.4, {
      count: 16, spin: i * 0.5, y: (i % 4) * 0.8,
    });
  });
  sound(dimension, "ambient.weather.rain", center, { volume: 2, pitch: 0.6 });
}

export function crystalEffect(dimension, center) {
  if (mayBreakBlocks()) {
    const hollow = { x: center.x, y: center.y - 6, z: center.z };
    // 方解石の殻 → 内側をアメジストに → 中を空洞にする、の順で晶洞になる
    buildShell(dimension, hollow, { radius: 6, thickness: 1, candidates: ["minecraft:calcite"], priority: 4 });
    later(20, () => {
      buildShell(dimension, hollow, { radius: 5, thickness: 1, candidates: ["minecraft:amethyst_block"], priority: 4 });
      later(20, () => carveSphere(dimension, hollow, { radius: 4, priority: 4 }));
    });
  }
  scatter(dimension, "minecraft:endrod", center, { count: 20, radius: 4, height: 3 });
  sound(dimension, "random.glass", center, { pitch: 1.6 });
}
