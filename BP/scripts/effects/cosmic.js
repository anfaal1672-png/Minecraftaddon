/**
 * 宇宙カテゴリのTNT。
 *
 * 核系が「人が作った最大」なら、こちらは「宇宙が起こす最大」。
 * 規模で押すだけでなく、順番に段階を踏む演出を持たせてある。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks, scaledRadius } from "../core/settings.js";
import { blockAt, setIfEmpty, trySetBlock } from "../lib/blocks.js";
import { carveSphere, crumbleTerrain, fillBasin, flattenArea, scanDisk } from "../lib/terrain.js";
import { ringPoints } from "../lib/shapes.js";
import { burst, deepBoom, later, mushroomCloud, particle, repeat, ring, scatter, shake, sound } from "../lib/fx.js";
import {
  applyEffects, damageArea, entitiesNear, irradiate, knockOutward, pullInward, safeTeleport, spawn,
} from "../lib/entities.js";
import { blockPos, pick, rand, randomInDisk, randomInSphere } from "../lib/math.js";
import { igniteFires } from "./elemental.js";
import { radiationZone } from "./nuclear.js";

/**
 * 超新星TNT。
 * 1) 閃光 → 2) 外殻が吹き飛ぶ → 3) 中心が自分の重さで崩れ落ちる、の3段。
 */
export function supernovaEffect(dimension, center) {
  announce("§e§l✺ 超新星TNT: 星が終わりを迎えた ✺§r");

  // 1) 閃光
  burst(dimension, "minecraft:huge_explosion_emitter", center, { count: 12, radius: 4 });
  deepBoom(dimension, center, { volume: 8, pitch: 0.5 });
  shake(dimension, center, { radius: 150, intensity: 1.0, seconds: 5 });
  applyEffects(dimension, center, 60, [["minecraft:blindness", 100, 0]]);

  // 2) 外殻。輪が外へ広がりながら焼き払う
  for (let s = 1; s <= 10; s++) {
    later(s * 3, () => {
      const radius = s * 5;
      ring(dimension, "minecraft:basic_flame_particle", center, radius, { count: 20 + s * 6, y: 1 });
      damageArea(dimension, center, radius, 40 - s * 2, { minDamage: 4 });
      knockOutward(dimension, center, radius, 3.0);
    });
  }
  igniteFires(dimension, center, 20);
  carveSphere(dimension, center, { radius: scaledRadius(44), scorch: true, priority: 9 });

  // 3) 中心が崩れ落ちる
  later(70, () => {
    announce("§7✺ ...そして中心が崩れ落ちた ✺§r");
    crumbleTerrain(dimension, center, { radius: 16, depth: 10, height: 18, priority: 7 });
    sound(dimension, "random.explode", center, { volume: 5, pitch: 0.35 });
  });
}

/**
 * 中性子星TNT。半径は狭いが、内側は跡形も残らない。
 * 外へ広がる代わりに、外にあるものを内へ引きずり込む。
 */
export function neutronEffect(dimension, center) {
  announce("§f◉ 中性子星TNT: 途方もなく重い一点§r");
  sound(dimension, "portal.portal", center, { pitch: 0.3 });

  repeat(20, 3, (i) => {
    pullInward(dimension, center, 30, 20, { vertical: 0.8, cap: 1.8 });
    ring(dimension, "minecraft:endrod", center, 8 - (i % 8) * 0.8, { count: 16, spin: i * 0.5 });
  });

  later(60, () => {
    carveSphere(dimension, center, { radius: scaledRadius(12), priority: 9 });
    damageArea(dimension, center, 14, 200, { minDamage: 40 });
    // 潰れた跡は極端に硬い床になる
    if (mayBreakBlocks()) {
      scanDisk(dimension, { ...center, y: center.y - 12 }, { radius: 12, layers: [0, 0], name: "neutron" },
        (dim, loc) => trySetBlock(dim, loc, ["minecraft:obsidian"]));
    }
    deepBoom(dimension, center, { volume: 6, pitch: 0.3 });
    shake(dimension, center, { radius: 80, intensity: 1.0, seconds: 3 });
  });
}

/**
 * ワームホールTNT。遠く離れた場所と繋がり、巻き込まれたものが送られる。
 */
export const WORMHOLE_RANGE = 400;

export function wormholeEffect(dimension, center) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 150 + Math.random() * (WORMHOLE_RANGE - 150);
  const exit = {
    x: center.x + Math.cos(angle) * distance,
    y: center.y,
    z: center.z + Math.sin(angle) * distance,
  };
  announce(`§5◎ ワームホールTNT: §d${Math.round(distance)}§5 ブロック先へ繋がった ◎§r`);
  sound(dimension, "mob.endermen.portal", center, { volume: 2, pitch: 0.5 });

  // 口が開いていく
  repeat(15, 4, (i) => {
    for (const p of ringPoints(center, 1 + i * 0.6, 14, { y: 1, spin: i * 0.6 })) {
      particle(dimension, "minecraft:endrod", p);
    }
    pullInward(dimension, center, 14, 6, { vertical: 0.4, cap: 0.8 });
  });

  later(60, () => {
    let sent = 0;
    for (const ent of entitiesNear(dimension, center, 10)) {
      const moved = safeTeleport(ent, (attempt) => ({
        x: exit.x + rand(-6, 6),
        y: exit.y + 4 + attempt * 6,
        z: exit.z + rand(-6, 6),
      }));
      if (moved) sent++;
    }
    if (sent > 0) announce(`§5◎ ${sent} 体が向こう側へ送られた ◎§r`);
    burst(dimension, "minecraft:endrod", center, { count: 30, radius: 4 });
    sound(dimension, "mob.endermen.portal", center, { pitch: 1.4 });
  });
}

/**
 * 銀河TNT。渦を巻く腕が外へ広がり、その形が地面に残る。
 */
export function galaxyEffect(dimension, center) {
  announce("§9✧ 銀河TNT: 腕が広がっていく ✧§r");
  sound(dimension, "beacon.activate", center, { pitch: 0.6 });

  const ARMS = 4;
  const LENGTH = 26;
  for (let step = 1; step <= LENGTH; step++) {
    later(step * 2, () => {
      for (let arm = 0; arm < ARMS; arm++) {
        // 対数螺旋。外へ行くほど後ろへ反る
        const angle = (Math.PI * 2 * arm) / ARMS + step * 0.22;
        const radius = step * 1.1;
        const spot = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + 1,
          z: center.z + Math.sin(angle) * radius,
        };
        particle(dimension, "minecraft:endrod", spot);
        particle(dimension, "minecraft:totem_particle", spot);
        if (mayBreakBlocks() && step % 2 === 0) {
          const floor = blockPos({ ...spot, y: spot.y - 2 });
          const block = blockAt(dimension, floor);
          if (block && block.typeId !== "minecraft:air") {
            trySetBlock(dimension, floor, [pick(["minecraft:amethyst_block", "minecraft:purpur_block", "minecraft:crying_obsidian"])]);
          }
        }
      }
    });
  }
  later(LENGTH * 2 + 10, () => {
    knockOutward(dimension, center, 26, 1.6, { lift: 0.6 });
    sound(dimension, "random.levelup", center, { pitch: 0.7 });
  });
}

/**
 * 彗星TNT。着弾までに尾を引き、落ちた場所に氷と岩を撒く。
 */
export function cometEffect(dimension, center) {
  announce("§b☄ 彗星TNT: 尾を引いて落ちた ☄§r");
  sound(dimension, "random.explode", center, { pitch: 0.8 });

  igniteFires(dimension, center, 6);
  damageArea(dimension, center, 14, 26, { launch: 0.5 });
  shake(dimension, center, { radius: 40, intensity: 0.7, seconds: 2 });
  carveSphere(dimension, center, { radius: scaledRadius(9), priority: 6 });

  // 撒き散らされた氷と岩
  if (mayBreakBlocks()) {
    scanDisk(dimension, center, { radius: 14, layers: [0, 0], name: "comet" }, (dim, loc) => {
      if (Math.random() > 0.12) return;
      setIfEmpty(dim, loc, pick(["minecraft:packed_ice", "minecraft:blue_ice", "minecraft:cobblestone"]));
    });
  }
  repeat(12, 4, () => scatter(dimension, "minecraft:snowflake_particle", center, {
    count: 14, radius: 12, height: 4,
  }));
}

/**
 * 太陽フレアTNT。空を昼に変え、地表を焼き払う。
 */
export function solarflareEffect(dimension, center) {
  announce("§6☀ 太陽フレアTNT: 空が白く焼けた ☀§r");
  try {
    dimension.runCommand("time set noon");
  } catch (err) {}

  burst(dimension, "minecraft:huge_explosion_emitter", { ...center, y: center.y + 6 }, { count: 6, radius: 4 });
  applyEffects(dimension, center, 40, [["minecraft:blindness", 80, 0]]);

  // 上から順に焼けていく
  repeat(10, 6, (i, progress) => {
    const radius = 6 + progress * 16;
    igniteFires(dimension, center, radius, 0.2);
    scatter(dimension, "minecraft:basic_flame_particle", center, { count: 24, radius, height: 5 });
    for (const ent of entitiesNear(dimension, center, radius, { items: false })) {
      try {
        ent.setOnFire(8, true);
      } catch (err) {}
    }
    if (i === 5) sound(dimension, "mob.ghast.fireball", center, { volume: 3 });
  });
  damageArea(dimension, center, 24, 34);
}

/**
 * 星雲TNT。害は無く、色とりどりの雲がしばらく漂う。
 */
export function nebulaEffect(dimension, center) {
  announce("§d✧ 星雲TNT: 色の雲が広がった ✧§r");
  sound(dimension, "beacon.power", center, { pitch: 0.8 });

  const CLOUD = ["minecraft:endrod", "minecraft:totem_particle", "minecraft:villager_happy", "minecraft:heart_particle"];
  repeat(40, 4, (i) => {
    for (let n = 0; n < 12; n++) {
      const spot = randomInSphere({ ...center, y: center.y + 8 }, 14);
      particle(dimension, pick(CLOUD), spot);
    }
    if (i % 10 === 0) sound(dimension, "random.orb", center, { pitch: 0.6 + i * 0.02 });
  });
  applyEffects(dimension, center, 16, [
    ["minecraft:night_vision", 600, 0],
    ["minecraft:regeneration", 100, 0],
  ]);
}

/**
 * ビッグバンTNT。すべてを消してから、そこに新しい地形を作り直す。
 * このアドオンで唯一「壊した後に作る」TNT。
 */
export function bigbangEffect(dimension, center) {
  announce("§f§l✷✷✷ ビッグバンTNT: 何もかもが消えた ✷✷✷§r");

  // 1) すべてを消す
  const radius = scaledRadius(50);
  carveSphere(dimension, center, { radius, priority: 12 });
  irradiate(dimension, center, 60, 150);
  knockOutward(dimension, center, 70, 4.5);
  shake(dimension, center, { radius: 200, intensity: 1.0, seconds: 6 });
  deepBoom(dimension, center, { volume: 10, pitch: 0.3 });
  mushroomCloud(dimension, center, {
    stemHeight: 50, capRadius: 40, duration: 160, lingerTicks: 260, densityMult: 2.2,
  });
  radiationZone(dimension, center, { radius: 30, duration: 1200, amplifier: 2, lingerTicks: 600 });
  igniteFires(dimension, center, 24);

  // 2) 何もない場所に、新しい地形を作り直す
  later(160, () => {
    announce("§f✷ ...そして、そこに新しい世界が始まった ✷§r");
    sound(dimension, "beacon.activate", center, { volume: 3, pitch: 0.5 });

    flattenArea(dimension, center, { radius: 28, height: 4, fill: "minecraft:stone", priority: 8 });
    later(40, () => {
      if (!mayBreakBlocks()) return;
      // 地面と草
      scanDisk(dimension, { ...center, y: center.y - 1 }, { radius: 28, layers: [0, 0], name: "bigbang:soil" },
        (dim, loc) => trySetBlock(dim, loc, ["minecraft:grass_block"]));
      // 湖
      fillBasin(dimension, { x: center.x + 14, y: center.y - 1, z: center.z + 6 }, {
        radius: 8, depth: 4, priority: 6,
      });
      // 木と花
      later(40, () => {
        for (let i = 0; i < 24; i++) {
          const spot = blockPos(randomInDisk(center, 24));
          plantTree(dimension, { x: spot.x, y: Math.floor(center.y), z: spot.z });
        }
        for (let i = 0; i < 40; i++) {
          const spot = blockPos(randomInDisk(center, 26));
          setIfEmpty(dimension, { x: spot.x, y: Math.floor(center.y), z: spot.z },
            pick(["minecraft:poppy", "minecraft:dandelion", "minecraft:short_grass", "minecraft:tallgrass"]));
        }
        for (let i = 0; i < 6; i++) spawn(dimension, pick(["minecraft:cow", "minecraft:sheep", "minecraft:chicken"]), randomInDisk(center, 10, 1));
        announce("§a✷ 草が生え、木が育ち、生き物が戻ってきた ✷§r");
        sound(dimension, "random.levelup", center, { volume: 2 });
      });
    });
  });
}

/**
 * 木を1本生やす。森TNTとビッグバンTNTで共用。
 * 苗木を植えて待つ方式だと確実に育たないので、幹と葉を直接置く。
 */
export function plantTree(dimension, base, { height = null, log = "minecraft:oak_log", leaves = "minecraft:oak_leaves" } = {}) {
  const trunk = height ?? 4 + Math.floor(Math.random() * 3);
  const ground = blockAt(dimension, { x: base.x, y: base.y - 1, z: base.z });
  if (!ground || ground.typeId === "minecraft:air") return false;

  for (let dy = 0; dy < trunk; dy++) {
    if (!setIfEmpty(dimension, { x: base.x, y: base.y + dy, z: base.z }, log)) break;
  }
  const top = base.y + trunk;
  for (let dy = -2; dy <= 1; dy++) {
    const spread = dy <= -1 ? 2 : 1;
    for (let dx = -spread; dx <= spread; dx++) {
      for (let dz = -spread; dz <= spread; dz++) {
        if (Math.abs(dx) === spread && Math.abs(dz) === spread && Math.random() < 0.6) continue;
        setIfEmpty(dimension, { x: base.x + dx, y: top + dy, z: base.z + dz }, leaves);
      }
    }
  }
  return true;
}
