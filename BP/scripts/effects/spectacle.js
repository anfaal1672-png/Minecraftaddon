/**
 * 見て楽しむための、派手なTNT。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, trySetBlock } from "../lib/blocks.js";
import { scanDisk } from "../lib/terrain.js";
import { diskCells } from "../lib/shapes.js";
import { applyEffects, spawn } from "../lib/entities.js";
import { burst, later, particle, repeat, ring, scatter, sound } from "../lib/fx.js";
import { blockPos, pick, randomInDisk } from "../lib/math.js";
import { rollRandomEffect } from "./nuclear.js";

export function confettiEffect(dimension, center) {
  applyEffects(dimension, center, 6, [
    ["minecraft:jump_boost", 200, 1],
    ["minecraft:speed", 200, 1],
  ]);
  sound(dimension, "random.levelup", center);
  repeat(6, 4, () => scatter(dimension, "minecraft:totem_particle", center, { count: 14, radius: 4, height: 3 }));
}

export function musicEffect(dimension, center) {
  // ドミソド…と上って下りる、分かりやすい音階
  const notes = [0, 4, 7, 12, 7, 4, 0];
  notes.forEach((semitone, i) => {
    later(i * 4, () => {
      sound(dimension, "note.harp", center, { pitch: Math.pow(2, semitone / 12) });
      scatter(dimension, "minecraft:totem_particle", { ...center, y: center.y + 1 }, { count: 4, radius: 1.5, height: 1 });
    });
  });
}

export function arrowEffect(dimension, center) {
  const COUNT = 16;
  for (let i = 0; i < COUNT; i++) {
    const angle = (Math.PI * 2 * i) / COUNT;
    const arrow = spawn(dimension, "minecraft:arrow", { x: center.x, y: center.y + 1, z: center.z });
    if (!arrow) continue;
    try {
      arrow.applyImpulse({ x: Math.cos(angle) * 1.2, y: 0.1, z: Math.sin(angle) * 1.2 });
    } catch (err) {}
  }
  sound(dimension, "random.bow", center);
}

export function fireworksEffect(dimension, center) {
  announce("§e✨ 花火大乱舞TNT ✨§r");
  for (let i = 0; i < 14; i++) {
    later(i * 3, () => {
      const rocket = spawn(dimension, "minecraft:fireworks_rocket", randomInDisk(center, 3, 2));
      if (!rocket) return;
      try {
        rocket.applyImpulse({
          x: (Math.random() - 0.5) * 0.2,
          y: 1.2 + Math.random() * 0.6,
          z: (Math.random() - 0.5) * 0.2,
        });
      } catch (err) {}
    });
  }
}

export function meteorEffect(dimension, center) {
  announce("§6☄ 隕石雨TNT: 空から隕石が降り注ぐ ☄§r");
  const COUNT = 6;
  const FALL_STEPS = 8;
  for (let i = 0; i < COUNT; i++) {
    const spot = randomInDisk(center, 7);
    const start = i * 12;
    for (let s = 0; s < FALL_STEPS; s++) {
      later(start + s * 2, () =>
        particle(dimension, "minecraft:basic_flame_particle", { ...spot, y: center.y + (FALL_STEPS - s) * 2.2 })
      );
    }
    later(start + FALL_STEPS * 2 + 2, () => {
      try {
        dimension.createExplosion(spot, 6, {
          breaksBlocks: mayBreakBlocks(),
          causesFire: mayBreakBlocks(),
        });
      } catch (err) {}
    });
  }
}

export function confusionEffect(dimension, center) {
  applyEffects(dimension, center, 6, [
    ["minecraft:nausea", 160, 2],
    ["minecraft:slowness", 80, 1],
  ]);
  burst(dimension, "minecraft:witchspell_emitter", center, { count: 14, radius: 3 });
  sound(dimension, "mob.endermen.stare", center, { pitch: 0.7 });
}

export function curseEffect(dimension, center) {
  announce("§8§l☠ 呪いTNTが不吉な力を解き放った ☠§r");
  applyEffects(dimension, center, 6, [
    ["minecraft:weakness", 200, 1],
    ["minecraft:slowness", 160, 1],
    ["minecraft:hunger", 200, 1],
    ["minecraft:darkness", 100, 0],
  ]);
  sound(dimension, "mob.wither.death", center);
  burst(dimension, "minecraft:witchspell_emitter", center, { count: 18, radius: 4 });
}

/**
 * ディスコTNT。足元を一時的にカラフルな床に変え、音楽と一緒に踊らせる。
 * 変えたブロックは必ず元に戻す。
 */
export const DISCO_COLORS = [
  "minecraft:red_concrete", "minecraft:yellow_concrete", "minecraft:lime_concrete",
  "minecraft:light_blue_concrete", "minecraft:purple_concrete", "minecraft:magenta_concrete",
];

export function discoEffect(dimension, center) {
  announce("§d♪ ディスコTNTが踊り出した ♪§r");
  applyEffects(dimension, center, 6, [
    ["minecraft:speed", 140, 1],
    ["minecraft:jump_boost", 140, 1],
  ]);

  if (!mayBreakBlocks()) {
    repeat(7, 8, () => {
      sound(dimension, "random.orb", center);
      scatter(dimension, "minecraft:totem_particle", center, { count: 8, radius: 4, height: 2 });
    });
    return;
  }

  // 元の床を覚えてから光らせる
  const base = blockPos(center);
  const floor = [];
  for (const cell of diskCells(4)) {
    const loc = { x: base.x + cell.dx, y: base.y - 1, z: base.z + cell.dz };
    const block = blockAt(dimension, loc);
    if (!block || block.typeId === "minecraft:air") continue;
    floor.push({ loc, typeId: block.typeId });
  }

  repeat(7, 8, () => {
    for (const tile of floor) trySetBlock(dimension, tile.loc, [pick(DISCO_COLORS)]);
    sound(dimension, "random.orb", center);
    scatter(dimension, "minecraft:totem_particle", center, { count: 6, radius: 4, height: 2 });
  });

  // 踊り終わったら片付ける
  later(7 * 8 + 4, () => {
    for (const tile of floor) trySetBlock(dimension, tile.loc, [tile.typeId]);
  });
}

/**
 * 虹TNT。何が出るか分からないが、当たり外れの幅は抑えてある。
 * 威力6の中堅TNTなので、核級を引いてしまわないよう候補を選んである。
 */
export const RAINBOW_POOL = [
  "iceEffect", "poisonEffect", "fireEffect", "thunderEffect", "teleportEffect",
  "healEffect", "confettiEffect", "antiGravityEffect", "lavaEffect", "waterEffect",
  "darknessEffect", "summonEffect", "earthquakeEffect", "bouncyEffect", "webEffect",
  "treasureEffect", "swapEffect", "confusionEffect", "grassEffect", "desertEffect",
  "snowgolemEffect", "beeEffect", "arrowEffect", "musicEffect", "tsunamiEffect",
  "harvestEffect", "xpEffect", "slimeEffect", "animalEffect", "honeyEffect",
  "feastEffect", "cactusEffect", "glowEffect", "chorusEffect",
];

export function rainbowEffect(dimension, center) {
  for (let i = 0; i < 7; i++) {
    later(i * 2, () => ring(dimension, "minecraft:totem_particle", center, 1 + i, { count: 10 + i * 3, y: i * 0.4 }));
  }
  rollRandomEffect(dimension, center, RAINBOW_POOL, "§d虹TNT: ");
}

/* ------------------------------------------------------------------ */
/*  オーロラ・雪祭り                                                   */
/* ------------------------------------------------------------------ */

/**
 * オーロラTNT。空に揺れる光のカーテン。害は無い。
 * 帯を波打たせるために、位相をずらしたサインで高さを決めている。
 */
export function auroraEffect(dimension, center) {
  announce("§b✧ オーロラTNT: 空に光のカーテンが揺れている ✧§r");
  sound(dimension, "beacon.power", center, { volume: 2, pitch: 1.2 });

  const CURTAIN_WIDTH = 24;
  const COLORS = ["minecraft:endrod", "minecraft:totem_particle", "minecraft:villager_happy"];

  repeat(60, 3, (frame) => {
    for (let i = -CURTAIN_WIDTH; i <= CURTAIN_WIDTH; i += 2) {
      // 横に流れる波。frame を足すことでカーテンが揺れて見える
      const wave = Math.sin(i * 0.25 + frame * 0.2) * 3;
      const height = 18 + wave;
      for (let h = 0; h < 5; h++) {
        particle(dimension, COLORS[(h + frame) % COLORS.length], {
          x: center.x + i,
          y: center.y + height + h * 0.8,
          z: center.z + Math.sin(i * 0.15 + frame * 0.1) * 6,
        });
      }
    }
  });
  applyEffects(dimension, center, 20, [["minecraft:night_vision", 900, 0]]);
}

export function snowfestEffect(dimension, center) {
  announce("§f❄ 雪祭りTNT: 雪が降ってきた ❄§r");
  sound(dimension, "random.glass", center, { pitch: 1.6 });

  // 積もる雪
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 10, layers: [0, 0], name: "snowfest" }, (dim, loc) => {
      if (Math.random() > 0.6) return;
      const block = blockAt(dim, loc);
      if (!block || block.typeId !== "minecraft:air") return;
      const below = blockAt(dim, { x: loc.x, y: loc.y - 1, z: loc.z });
      if (below && below.typeId !== "minecraft:air") trySetBlock(dim, loc, ["minecraft:snow_layer"]);
    });
  }
  // 雪だるまと降り続ける雪
  for (let i = 0; i < 4; i++) later(i * 6, () => spawn(dimension, "minecraft:snow_golem", randomInDisk(center, 4)));
  repeat(30, 4, () => scatter(dimension, "minecraft:snowflake_particle", { ...center, y: center.y + 6 }, {
    count: 20, radius: 10, height: 4,
  }));
  applyEffects(dimension, center, 10, [["minecraft:jump_boost", 200, 1]]);
}
