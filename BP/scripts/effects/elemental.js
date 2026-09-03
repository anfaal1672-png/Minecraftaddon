/**
 * 火・水・氷・雷・毒といった自然の力を扱うTNT。
 */
import { world, system, ItemStack } from "@minecraft/server";
import { trySetBlock } from "../util/blocks.js";
import { nearbyEntities } from "../util/entities.js";

export function iceEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:slowness", 100, { amplifier: 3, showParticles: true });
    } catch (err) {}
  }
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      for (let dy = -2; dy <= 2; dy++) {
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (!b) continue;
          if (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water") {
            b.setType("minecraft:ice");
          } else if (b.typeId === "minecraft:air" && Math.random() < 0.25) {
            const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
            if (below && below.typeId !== "minecraft:air") {
              b.setType("minecraft:snow_layer");
            }
          }
        } catch (err) {}
      }
    }
  }
  for (let n = 0; n < 10; n++) {
    try {
      dimension.spawnParticle("minecraft:snowflake_particle", {
        x: center.x + (Math.random() - 0.5) * 6,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 6,
      });
    } catch (err) {}
  }
}

export function iceageEffect(dimension, center) {
  const R = 7;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dz * dz > R * R) continue;
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (!b) continue;
          if (b.typeId === "minecraft:water") b.setType("minecraft:ice");
          else if (b.typeId === "minecraft:air" && Math.random() < 0.3) {
            const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
            if (below && below.typeId !== "minecraft:air") trySetBlock(dimension, loc, ["minecraft:snow_layer"]);
          }
        } catch (err) {}
      }
    }
  }
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      ent.addEffect("minecraft:slowness", 200, { amplifier: 4, showParticles: true });
    } catch (err) {}
  }
}

export function poisonEffect(dimension, center) {
  let rounds = 0;
  const id = system.runInterval(() => {
    rounds++;
    for (const ent of nearbyEntities(dimension, center, 6)) {
      try {
        ent.addEffect("minecraft:poison", 60, { amplifier: 1, showParticles: true });
      } catch (err) {}
    }
    try {
      dimension.spawnParticle("minecraft:mob_spell_particle", center);
    } catch (err) {}
    if (rounds >= 5) system.clearRun(id);
  }, 20);
}

export function fireEffect(dimension, center, radius = 4) {
  const R = radius;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      if (Math.random() > 0.35) continue;
      try {
        const b = dimension.getBlock(loc);
        const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (b && b.typeId === "minecraft:air" && below && below.typeId !== "minecraft:air" && below.typeId !== "minecraft:water") {
          b.setType("minecraft:fire");
        }
      } catch (err) {}
    }
  }
}

export function lavaEffect(dimension, center) {
  const base = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };
  trySetBlock(dimension, base, ["minecraft:lava"]);
  const offsets = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ];
  for (const o of offsets) {
    if (Math.random() < 0.5) {
      trySetBlock(dimension, { x: base.x + o.x, y: base.y, z: base.z + o.z }, ["minecraft:lava"]);
    }
  }
  for (const ent of nearbyEntities(dimension, center, 5)) {
    try {
      ent.setOnFire(6, true);
    } catch (err) {}
  }
}

export function waterEffect(dimension, center) {
  const base = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };
  trySetBlock(dimension, base, ["minecraft:water"]);
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.extinguishFire(true);
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, 0.8);
    } catch (err) {}
  }
  const R = 3;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const loc = { x: base.x + dx, y: base.y, z: base.z + dz };
      try {
        const b = dimension.getBlock(loc);
        if (b && b.typeId === "minecraft:fire") b.setType("minecraft:air");
      } catch (err) {}
    }
  }
}

export function tsunamiEffect(dimension, center) {
  const placed = [];
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R || Math.random() > 0.3) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (b && b.typeId === "minecraft:air" && trySetBlock(dimension, loc, ["minecraft:water"])) {
          placed.push(loc);
        }
      } catch (err) {}
    }
  }
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, 1.3);
    } catch (err) {}
  }
  // 引き潮。自分が置いた水だけを消す。
  // 以前は範囲内の水を無条件に消していたので、海辺や池の近くで使うと
  // 元々そこにあった水まで一緒に消えてしまっていた。
  system.runTimeout(() => {
    for (const loc of placed) {
      try {
        const b = dimension.getBlock(loc);
        if (b && b.typeId === "minecraft:water") b.setType("minecraft:air");
      } catch (err) {}
    }
  }, 100);
}

export function thunderEffect(dimension, center) {
  for (let i = 0; i < 6; i++) {
    system.runTimeout(() => {
      try {
        const x = center.x + (Math.random() - 0.5) * 10;
        const z = center.z + (Math.random() - 0.5) * 10;
        dimension.spawnEntity("minecraft:lightning_bolt", { x, y: center.y, z });
      } catch (err) {}
    }, i * 3);
  }
}

export function stormEffect(dimension, center) {
  // WeatherType は "Thunder" (先頭大文字) の列挙値。
  // これまで "thunder" を渡していたため常に例外になり、
  // 嵐TNTなのに天候が一度も変わっていなかった。
  try {
    world.setWeather("Thunder", 6000);
  } catch (err) {
    try {
      dimension.runCommand("weather thunder 300");
    } catch (err2) {}
  }
  for (let i = 0; i < 4; i++) {
    system.runTimeout(() => {
      try {
        dimension.spawnEntity("minecraft:lightning_bolt", {
          x: center.x + (Math.random() - 0.5) * 8,
          y: center.y,
          z: center.z + (Math.random() - 0.5) * 8,
        });
      } catch (err) {}
    }, i * 4);
  }
}

export function darknessEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 7)) {
    try {
      ent.addEffect("minecraft:blindness", 100, { amplifier: 0, showParticles: false });
      ent.addEffect("minecraft:nausea", 60, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }
  for (let n = 0; n < 10; n++) {
    try {
      dimension.spawnParticle("minecraft:basic_smoke_particle", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
}

export function glowEffect(dimension, center) {
  const R = 5;
  for (let i = 0; i < 8; i++) {
    const loc = {
      x: Math.floor(center.x) + Math.floor((Math.random() - 0.5) * R * 2),
      y: Math.floor(center.y) + Math.floor((Math.random() - 0.5) * 4),
      z: Math.floor(center.z) + Math.floor((Math.random() - 0.5) * R * 2),
    };
    try {
      const b = dimension.getBlock(loc);
      if (b && b.typeId === "minecraft:air") trySetBlock(dimension, loc, ["minecraft:glowstone"]);
    } catch (err) {}
  }
}

export function daynightEffect(dimension, center) {
  try {
    const t = world.getTimeOfDay();
    world.setTimeOfDay(t < 13000 ? 13000 : 0);
  } catch (err) {
    try {
      dimension.runCommand("time set night");
    } catch (err2) {}
  }
  try {
    dimension.playSound("random.orb", center);
  } catch (err) {}
}

export function scorchedEffect(dimension, center) {
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) - 1, z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (b && (b.typeId === "minecraft:grass_block" || b.typeId === "minecraft:dirt")) {
          b.setType(Math.random() < 0.3 ? "minecraft:netherrack" : "minecraft:coarse_dirt");
        }
      } catch (err) {}
    }
  }
}

export const ORE_SMELT = {
  "minecraft:iron_ore": "minecraft:iron_ingot",
  "minecraft:deepslate_iron_ore": "minecraft:iron_ingot",
  "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:deepslate_gold_ore": "minecraft:gold_ingot",
  "minecraft:copper_ore": "minecraft:copper_ingot",
  "minecraft:deepslate_copper_ore": "minecraft:copper_ingot",
  "minecraft:ancient_debris": "minecraft:netherite_scrap",
  "minecraft:nether_gold_ore": "minecraft:gold_ingot",
};

/** その場で焼き固まるブロック (製錬レシピのうち、ブロックのまま残るもの) */
export const SMELT_TO_BLOCK = {
  "minecraft:sand": ["minecraft:glass"],
  "minecraft:red_sand": ["minecraft:glass"],
  "minecraft:cobblestone": ["minecraft:stone"],
  "minecraft:cobbled_deepslate": ["minecraft:deepslate"],
  "minecraft:clay": ["minecraft:terracotta", "minecraft:hardened_clay"],
  "minecraft:wet_sponge": ["minecraft:sponge"],
};

export function smelterEffect(dimension, center) {
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (!b) continue;
          const drop = ORE_SMELT[b.typeId];
          if (drop) {
            b.setType("minecraft:air");
            dimension.spawnItem(new ItemStack(drop, 1), loc);
            continue;
          }
          const baked = SMELT_TO_BLOCK[b.typeId];
          if (baked) trySetBlock(dimension, loc, baked);
        } catch (err) {}
      }
    }
  }
}

/**
 * 黒曜石TNT。溶岩を黒曜石に変えるだけだったので、溶岩の無い場所で使うと
 * 威力0と相まって本当に何も起きなかった。そこで、爆心地を包む黒曜石の殻も
 * 張るようにした。空いている場所だけを埋めるので、既存の建築は壊さない。
 */
export function obsidianEffect(dimension, center) {
  const base = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };

  // 1) 周囲の溶岩を黒曜石に変える
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        try {
          const b = dimension.getBlock({ x: base.x + dx, y: base.y + dy, z: base.z + dz });
          if (b && (b.typeId === "minecraft:lava" || b.typeId === "minecraft:flowing_lava")) {
            b.setType("minecraft:obsidian");
          }
        } catch (err) {}
      }
    }
  }

  // 2) 爆心地を黒曜石のドームで包む (球の殻の部分だけを、空いている場所に置く)
  const SR = 4;
  for (let dx = -SR; dx <= SR; dx++) {
    for (let dy = -SR; dy <= SR; dy++) {
      for (let dz = -SR; dz <= SR; dz++) {
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > SR * SR || d2 < (SR - 1) * (SR - 1)) continue;
        const loc = { x: base.x + dx, y: base.y + dy, z: base.z + dz };
        try {
          const b = dimension.getBlock(loc);
          if (b && (b.typeId === "minecraft:air" || b.typeId === "minecraft:water" ||
                    b.typeId === "minecraft:flowing_water")) {
            b.setType("minecraft:obsidian");
          }
        } catch (err) {}
      }
    }
  }
  try {
    dimension.playSound("random.anvil_land", center);
  } catch (err) {}
}

export function vacuumEffect(dimension, center) {
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:lava" ||
                    b.typeId === "minecraft:flowing_water" || b.typeId === "minecraft:flowing_lava")) {
            b.setType("minecraft:air");
          }
        } catch (err) {}
      }
    }
  }
}
