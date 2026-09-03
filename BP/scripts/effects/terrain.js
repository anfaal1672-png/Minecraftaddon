/**
 * 地形や植生を作り変えるTNT。
 */
import { system } from "@minecraft/server";
import { announce } from "../core/announce.js";
import { trySetBlock } from "../util/blocks.js";
import { nearbyEntities } from "../util/entities.js";

export function earthquakeEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 7)) {
    try {
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, 0.9);
    } catch (err) {}
  }
  const base = { x: Math.floor(center.x), y: Math.floor(center.y) - 1, z: Math.floor(center.z) };
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (Math.random() > 0.3) continue;
      if (dx * dx + dz * dz > R * R) continue;
      try {
        const b = dimension.getBlock({ x: base.x + dx, y: base.y, z: base.z + dz });
        if (b && b.typeId !== "minecraft:air" && b.typeId !== "minecraft:bedrock") {
          b.setType("minecraft:air");
        }
      } catch (err) {}
    }
  }
}

// 草ブロックはバージョンによって ID が違うことがあるので候補を並べておく
export const MEADOW_PLANTS = [
  ["minecraft:short_grass", "minecraft:tallgrass"],
  ["minecraft:poppy"], ["minecraft:dandelion"],
  ["minecraft:blue_orchid"], ["minecraft:allium"], ["minecraft:cornflower"],
];

export const MEADOW_SOIL = new Set([
  "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol",
  "minecraft:sand", "minecraft:gravel", "minecraft:stone",
]);

export function grassEffect(dimension, center) {
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        let below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (!b || b.typeId !== "minecraft:air" || !below) continue;
        // 草原TNTなのに、元から草ブロックの場所にしか花が咲かなかった。
        // 土や砂も草ブロックに変えてから生やすようにする。
        if (MEADOW_SOIL.has(below.typeId)) {
          below.setType("minecraft:grass_block");
          below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        }
        if (!below || below.typeId !== "minecraft:grass_block") continue;
        if (Math.random() > 0.5) continue;
        trySetBlock(dimension, loc, MEADOW_PLANTS[Math.floor(Math.random() * MEADOW_PLANTS.length)]);
      } catch (err) {}
    }
  }
}

export function desertEffect(dimension, center) {
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) - 1, z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (b && (b.typeId === "minecraft:grass_block" || b.typeId === "minecraft:dirt")) {
          b.setType("minecraft:sand");
        }
      } catch (err) {}
      if (Math.random() < 0.08) {
        trySetBlock(dimension, { x: loc.x, y: loc.y + 1, z: loc.z }, ["minecraft:cactus"]);
      }
    }
  }
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:blindness", 40, { amplifier: 0, showParticles: false });
    } catch (err) {}
  }
}

export function cactusEffect(dimension, center) {
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R || Math.random() > 0.35) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (!b || b.typeId !== "minecraft:air" || !below) continue;
        // サボテンは砂の上にしか置けない。草原などで使うと一本も生えなかったので、
        // 土や草ブロックなら先に砂へ変えてから生やすようにした。
        if (below.typeId === "minecraft:grass_block" || below.typeId === "minecraft:dirt" ||
            below.typeId === "minecraft:coarse_dirt" || below.typeId === "minecraft:podzol") {
          below.setType("minecraft:sand");
        }
        const ground = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (ground && (ground.typeId === "minecraft:sand" || ground.typeId === "minecraft:red_sand")) {
          trySetBlock(dimension, loc, ["minecraft:cactus"]);
        }
      } catch (err) {}
    }
  }
}

export function honeyEffect(dimension, center) {
  const R = 3;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dz * dz > R * R || Math.random() > 0.6) continue;
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (b && b.typeId === "minecraft:air") trySetBlock(dimension, loc, ["minecraft:honey_block"]);
        } catch (err) {}
      }
    }
  }
}

export function builderEffect(dimension, center) {
  // ID がバージョンで揺れるものがあるので、候補を順に試す形にしてある
  const UPGRADE = {
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
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) - 1, z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        const up = b && UPGRADE[b.typeId];
        if (up) trySetBlock(dimension, loc, up);
      } catch (err) {}
    }
  }
}

export function shaftEffect(dimension, center) {
  const base = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };
  let depth = 0;
  const id = system.runInterval(() => {
    for (let i = 0; i < 3; i++) {
      depth++;
      const loc = { x: base.x, y: base.y - depth, z: base.z };
      try {
        const b = dimension.getBlock(loc);
        if (!b || b.typeId === "minecraft:bedrock" || b.typeId === "minecraft:water" || b.typeId === "minecraft:lava") {
          system.clearRun(id);
          return;
        }
        b.setType("minecraft:air");
      } catch (err) {
        system.clearRun(id);
        return;
      }
    }
    if (depth >= 40) system.clearRun(id);
  }, 1);
}

/*
 * 作物ごとの「成長度」を表す状態名と、その最大値。
 * 統合版ではビートルートも growth 0〜7 で、ネザーウォートだけは
 * growth ではなく age 0〜3 を使う。以前はどちらも growth の 3 を
 * 上限にしていたため、ビートルートは中途半端にしか育たず、
 * ネザーウォートに至っては状態名が違うので一切育っていなかった。
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
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      // 畑がTNTと同じ高さとは限らないので、上下1ブロックも見る
      for (let dy = -1; dy <= 1; dy++) {
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (!b) continue;
          const crop = CROP_STATES[b.typeId];
          if (!crop) continue;
          const cur = b.permutation.getState(crop.state);
          if (cur !== undefined && cur < crop.max) {
            b.setPermutation(b.permutation.withState(crop.state, crop.max));
          }
        } catch (err) {}
      }
    }
  }
}

/**
 * 隕石雨TNT: 空から隕石(炎の軌跡+着弾爆発)が何発も降ってくる。
 */
export function meteorEffect(dimension, center) {
  try {
    announce("§6☄ 隕石雨TNT: 空から隕石が降り注ぐ ☄§r");
  } catch (err) {}

  const count = 6;
  for (let i = 0; i < count; i++) {
    const ox = (Math.random() - 0.5) * 14;
    const oz = (Math.random() - 0.5) * 14;
    const startDelay = i * 12;
    const fallSteps = 8;
    for (let s = 0; s < fallSteps; s++) {
      system.runTimeout(() => {
        try {
          dimension.spawnParticle("minecraft:basic_flame_particle", {
            x: center.x + ox,
            y: center.y + (fallSteps - s) * 2.2,
            z: center.z + oz,
          });
        } catch (err) {}
      }, startDelay + s * 2);
    }
    system.runTimeout(() => {
      try {
        dimension.createExplosion({ x: center.x + ox, y: center.y, z: center.z + oz }, 6, {
          breaksBlocks: true,
          causesFire: true,
        });
      } catch (err) {}
    }, startDelay + fallSteps * 2 + 2);
  }
}
