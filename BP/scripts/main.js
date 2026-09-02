import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";

const NS = "manytnt";
const DEBUG = false;

/* ------------------------------------------------------------------ */
/*  チャット演出のミュート設定 (/scriptevent manytnt:mute で切替)        */
/* ------------------------------------------------------------------ */
let muted = false;
try {
  world.afterEvents.worldLoad.subscribe(() => {
    try {
      muted = world.getDynamicProperty("manytnt:muted") === true;
    } catch (err) {}
  });
} catch (err) {}

function announce(msg) {
  if (muted) return;
  try {
    world.sendMessage(msg);
  } catch (err) {}
}

/* ------------------------------------------------------------------ */
/*  チャットコマンド:                                                   */
/*   /scriptevent manytnt:mute ... 爆発時のチャット演出をON/OFF          */
/*   /scriptevent manytnt:help ... TNT一覧を表示                        */
/* ------------------------------------------------------------------ */
try {
  system.afterEvents.scriptEventReceive.subscribe((e) => {
    try {
      if (e.id === "manytnt:mute") {
        muted = !muted;
        try {
          world.setDynamicProperty("manytnt:muted", muted);
        } catch (err) {}
        world.sendMessage(muted ? "§7[manytnt] チャット演出をOFFにしました§r" : "§a[manytnt] チャット演出をONにしました§r");
      } else if (e.id === "manytnt:help") {
        const names = Object.keys(TNT_TABLE).map((k) => k.replace(`${NS}:`, ""));
        world.sendMessage(`§e[manytnt] 全${names.length}種類のTNT:§r ${names.join(", ")}`);
        world.sendMessage("§7着火: 火打石 / 炎・溶岩 / レッドストーン / 他の爆発。§r");
        world.sendMessage("§7チャット演出のON/OFF: /scriptevent manytnt:mute§r");
        world.sendMessage("§7実績・統計を見る: /scriptevent manytnt:stats§r");
      }
    } catch (err) {}
  });
} catch (err) {}

/* ------------------------------------------------------------------ */
/*  連鎖爆発の安全上限。                                                 */
/*  TNTを何百個も敷き詰めて一気に連鎖させるとゲームごと落ちる恐れがあるため */
/*  「直近2秒間に連鎖で着火した数」に上限を設け、超過分は無視する。         */
/*  プレイヤーが手動で着火する分には制限なし。                            */
/* ------------------------------------------------------------------ */
let recentChainIgnitions = 0;
const CHAIN_IGNITION_CAP = 120;
system.runInterval(() => {
  recentChainIgnitions = 0;
}, 40);

/* ------------------------------------------------------------------ */
/*  実績・統計システム。                                                 */
/*  爆発のたびに種類別の回数をワールドに保存し、節目でお祝いメッセージを出す。 */
/*  /scriptevent manytnt:stats で進捗を確認できる。                      */
/* ------------------------------------------------------------------ */
let stats = { counts: {}, total: 0, milestones: [] };
let statsLoaded = false;

function loadStats() {
  if (statsLoaded) return;
  statsLoaded = true;
  try {
    const raw = world.getDynamicProperty("manytnt:stats");
    if (typeof raw === "string") stats = JSON.parse(raw);
  } catch (err) {}
  if (!stats.counts) stats.counts = {};
  if (!stats.milestones) stats.milestones = [];
  if (typeof stats.total !== "number") stats.total = 0;
}

function saveStats() {
  try {
    world.setDynamicProperty("manytnt:stats", JSON.stringify(stats));
  } catch (err) {}
}

function hasMilestone(name) {
  return stats.milestones.includes(name);
}
function unlockMilestone(name, message) {
  if (hasMilestone(name)) return;
  stats.milestones.push(name);
  announce(message);
}

function recordExplosion(typeId) {
  loadStats();
  const shortName = typeId.replace(`${NS}:`, "");
  stats.counts[shortName] = (stats.counts[shortName] || 0) + 1;
  stats.total++;

  // 累計爆発数の節目
  const totalMilestones = [10, 50, 200, 1000, 5000];
  for (const m of totalMilestones) {
    if (stats.total === m) {
      unlockMilestone(`total_${m}`, `§6🏆 累計爆発数が${m}回に到達しました！§r`);
    }
  }

  // 核系タイトルの初回使用
  const NUKE_FIRSTS = {
    nuke_tnt: "§c☢ 実績解除: 初めての核実験§r",
    ultra_nuke_tnt: "§4☢ 実績解除: 更なる高みへ§r",
    hydrogen_bomb_tnt: "§5☢ 実績解除: 水爆保有国§r",
    tsar_bomba_tnt: "§d☢ 実績解除: 人類最大の爆発§r",
    armageddon_tnt: "§0§l☠ 実績解除: 終焉を見た者§r",
  };
  if (NUKE_FIRSTS[shortName] && !hasMilestone(`first_${shortName}`)) {
    unlockMilestone(`first_${shortName}`, NUKE_FIRSTS[shortName]);
  }

  // 全種類制覇
  const distinctUsed = Object.keys(stats.counts).length;
  const totalTypes = Object.keys(TNT_TABLE).length;
  if (distinctUsed >= totalTypes && !hasMilestone("all_types")) {
    unlockMilestone("all_types", `§b§l🏆🏆🏆 実績解除: 全${totalTypes}種類制覇！あなたは真のTNTマスターだ 🏆🏆🏆§r`);
  }

  saveStats();
}

try {
  system.afterEvents.scriptEventReceive.subscribe((e) => {
    try {
      if (e.id === "manytnt:stats") {
        loadStats();
        const distinctUsed = Object.keys(stats.counts).length;
        const totalTypes = Object.keys(TNT_TABLE).length;
        world.sendMessage(`§e[manytnt] 累計爆発数: §f${stats.total}§e回§r`);
        world.sendMessage(`§e[manytnt] 使用した種類: §f${distinctUsed} / ${totalTypes}§r`);
        const top = Object.entries(stats.counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => `${k}×${v}`)
          .join(", ");
        if (top) world.sendMessage(`§e[manytnt] よく使う上位5種: §f${top}§r`);
      }
    } catch (err) {}
  });
} catch (err) {}

/** 現在導火線が燃えているブロックの位置を覚えておく (二重着火防止) */
const litSet = new Set();
function keyOf(dimId, loc) {
  return `${dimId}:${loc.x},${loc.y},${loc.z}`;
}

/* ------------------------------------------------------------------ */
/*  各TNTタイプの設定                                                  */
/*  power  : 爆発の強さ (0なら通常の爆発は起こさず演出のみ)             */
/*  breaks : 地形を破壊するか                                          */
/*  fire   : 火をつけるか                                              */
/*  effect : 爆発時に追加で呼ばれる特殊効果関数                         */
/*  gravityPull / magnetPull : 導火線が燃えている間ずっと周囲を吸い込む */
/*  ※ 導火線の長さ・飛ぶ/落ちる物理挙動はすべて本物のバニラTNTエンティティに */
/*    完全に委任しているため、ここでは制御しない (通常TNTと全く同じになる) */
/* ------------------------------------------------------------------ */
const TNT_TABLE = {
  [`${NS}:mega_tnt`]: { power: 14, breaks: true, fire: false, effect: null },
  [`${NS}:mini_tnt`]: { power: 2, breaks: true, fire: false, effect: null },
  [`${NS}:nuke_tnt`]: { power: 20, breaks: true, underwater: true, fire: true, effect: nukeEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:ultra_nuke_tnt`]: { power: 35, breaks: true, underwater: true, fire: true, effect: ultraNukeEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:hydrogen_bomb_tnt`]: { power: 50, breaks: true, underwater: true, fire: true, effect: hydrogenBombEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:tsar_bomba_tnt`]: { power: 65, breaks: true, underwater: true, fire: true, effect: tsarBombaEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:antimatter_tnt`]: { power: 80, breaks: true, underwater: true, fire: true, effect: antimatterEffect, trail: "minecraft:endrod" },
  [`${NS}:ice_tnt`]: { power: 0, breaks: false, fire: false, effect: iceEffect, trail: "minecraft:snowflake_particle" },
  [`${NS}:poison_tnt`]: { power: 3, breaks: true, fire: false, effect: poisonEffect, trail: "minecraft:mob_spell_particle" },
  [`${NS}:fire_tnt`]: { power: 6, breaks: true, fire: true, effect: fireEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:thunder_tnt`]: { power: 4, breaks: true, fire: false, effect: thunderEffect, trail: "minecraft:totem_particle" },
  [`${NS}:gravity_tnt`]: { power: 3, breaks: false, fire: false, effect: gravityEffect, gravityPull: true, trail: "minecraft:endrod" },
  [`${NS}:teleport_tnt`]: { power: 4, breaks: true, fire: false, effect: teleportEffect, trail: "minecraft:endrod" },
  [`${NS}:heal_tnt`]: { power: 0, breaks: false, fire: false, effect: healEffect, trail: "minecraft:heart_particle" },
  [`${NS}:confetti_tnt`]: { power: 0, breaks: false, fire: false, effect: confettiEffect, trail: "minecraft:totem_particle" },
  [`${NS}:rainbow_tnt`]: { power: 6, breaks: true, fire: false, effect: rainbowEffect, trail: "minecraft:totem_particle" },
  [`${NS}:magnet_tnt`]: { power: 2, breaks: true, fire: false, effect: magnetBurstEffect, magnetPull: true, trail: "minecraft:villager_happy" },
  [`${NS}:antigravity_tnt`]: { power: 3, breaks: false, fire: false, effect: antiGravityEffect, trail: "minecraft:endrod" },
  [`${NS}:lava_tnt`]: { power: 8, breaks: true, fire: true, effect: lavaEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:water_tnt`]: { power: 0, breaks: false, fire: false, effect: waterEffect, trail: "minecraft:bubble_particle" },
  [`${NS}:darkness_tnt`]: { power: 2, breaks: false, fire: false, effect: darknessEffect, trail: "minecraft:basic_smoke_particle" },
  [`${NS}:summon_tnt`]: { power: 3, breaks: true, fire: false, effect: summonEffect, trail: "minecraft:mob_spell_particle" },
  [`${NS}:earthquake_tnt`]: { power: 6, breaks: true, fire: false, effect: earthquakeEffect },
  [`${NS}:bouncy_tnt`]: { power: 0, breaks: false, fire: false, effect: bouncyEffect },
  [`${NS}:web_tnt`]: { power: 2, breaks: false, fire: false, effect: webEffect },
  [`${NS}:treasure_tnt`]: { power: 3, breaks: true, fire: false, effect: treasureEffect, trail: "minecraft:villager_happy" },
  [`${NS}:swap_tnt`]: { power: 3, breaks: true, fire: false, effect: swapEffect, trail: "minecraft:endrod" },
  [`${NS}:confusion_tnt`]: { power: 2, breaks: false, fire: false, effect: confusionEffect, trail: "minecraft:mob_spell_particle" },
  [`${NS}:blackhole_tnt`]: { power: 0, breaks: true, fire: false, effect: blackholeEffect, trail: "minecraft:basic_smoke_particle" },
  [`${NS}:disco_tnt`]: { power: 0, breaks: false, fire: false, effect: discoEffect, trail: "minecraft:totem_particle" },
  [`${NS}:ufo_tnt`]: { power: 2, breaks: false, fire: false, effect: ufoEffect, trail: "minecraft:mob_spell_particle" },
  [`${NS}:fireworks_tnt`]: { power: 0, breaks: false, fire: false, effect: fireworksEffect, trail: "minecraft:totem_particle" },
  [`${NS}:meteor_tnt`]: { power: 4, breaks: true, fire: true, effect: meteorEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:curse_tnt`]: { power: 2, breaks: false, fire: false, effect: curseEffect, trail: "minecraft:mob_spell_particle" },
  [`${NS}:grass_tnt`]: { power: 0, breaks: false, fire: false, effect: grassEffect, trail: "minecraft:totem_particle" },
  [`${NS}:desert_tnt`]: { power: 2, breaks: true, fire: false, effect: desertEffect, trail: "minecraft:basic_smoke_particle" },
  [`${NS}:snowgolem_tnt`]: { power: 0, breaks: false, fire: false, effect: snowgolemEffect, trail: "minecraft:snowflake_particle" },
  [`${NS}:bee_tnt`]: { power: 2, breaks: false, fire: false, effect: beeEffect, trail: "minecraft:villager_happy" },
  [`${NS}:arrow_tnt`]: { power: 3, breaks: true, fire: false, effect: arrowEffect, trail: "minecraft:crit_particle" },
  [`${NS}:rocket_tnt`]: { power: 6, breaks: true, fire: false, effect: null, trail: "minecraft:basic_flame_particle", launchUp: true },
  [`${NS}:music_tnt`]: { power: 0, breaks: false, fire: false, effect: musicEffect, trail: "minecraft:totem_particle" },
  [`${NS}:tsunami_tnt`]: { power: 2, breaks: false, fire: false, effect: tsunamiEffect, trail: "minecraft:bubble_particle" },
  [`${NS}:smelter_tnt`]: { power: 0, breaks: false, fire: false, effect: smelterEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:harvest_tnt`]: { power: 0, breaks: false, fire: false, effect: harvestEffect, trail: "minecraft:totem_particle" },
  [`${NS}:daynight_tnt`]: { power: 2, breaks: false, fire: false, effect: daynightEffect, trail: "minecraft:endrod" },
  [`${NS}:storm_tnt`]: { power: 3, breaks: true, fire: false, effect: stormEffect, trail: "minecraft:totem_particle" },
  [`${NS}:xp_tnt`]: { power: 0, breaks: false, fire: false, effect: xpEffect, trail: "minecraft:villager_happy" },
  [`${NS}:enderman_tnt`]: { power: 2, breaks: false, fire: false, effect: endermanEffect, trail: "minecraft:endrod" },
  [`${NS}:slime_tnt`]: { power: 0, breaks: false, fire: false, effect: slimeEffect, trail: "minecraft:villager_happy" },
  [`${NS}:animal_tnt`]: { power: 0, breaks: false, fire: false, effect: animalEffect, trail: "minecraft:heart_particle" },
  [`${NS}:iceage_tnt`]: { power: 0, breaks: false, fire: false, effect: iceageEffect, trail: "minecraft:snowflake_particle" },
  [`${NS}:fortune_tnt`]: { power: 2, breaks: true, fire: false, effect: fortuneEffect, trail: "minecraft:totem_particle" },
  [`${NS}:builder_tnt`]: { power: 0, breaks: false, fire: false, effect: builderEffect, trail: "minecraft:crit_particle" },
  [`${NS}:shaft_tnt`]: { power: 0, breaks: false, fire: false, effect: shaftEffect, trail: "minecraft:basic_smoke_particle" },
  [`${NS}:beam_tnt`]: { power: 3, breaks: true, fire: false, effect: beamEffect, trail: "minecraft:endrod" },
  [`${NS}:invisibility_tnt`]: { power: 0, breaks: false, fire: false, effect: invisibilityEffect, trail: "minecraft:basic_smoke_particle" },
  [`${NS}:speed_tnt`]: { power: 0, breaks: false, fire: false, effect: speedEffect, trail: "minecraft:crit_particle" },
  [`${NS}:honey_tnt`]: { power: 0, breaks: false, fire: false, effect: honeyEffect, trail: "minecraft:villager_happy" },
  [`${NS}:scorched_tnt`]: { power: 4, breaks: true, fire: true, effect: scorchedEffect, trail: "minecraft:basic_flame_particle" },
  [`${NS}:feast_tnt`]: { power: 0, breaks: false, fire: false, effect: feastEffect, trail: "minecraft:heart_particle" },
  [`${NS}:cactus_tnt`]: { power: 1, breaks: false, fire: false, effect: cactusEffect, trail: "minecraft:crit_particle" },
  [`${NS}:obsidian_tnt`]: { power: 0, breaks: false, fire: false, effect: obsidianEffect, trail: "minecraft:endrod" },
  [`${NS}:glow_tnt`]: { power: 0, breaks: false, fire: false, effect: glowEffect, trail: "minecraft:villager_happy" },
  [`${NS}:vacuum_tnt`]: { power: 0, breaks: false, fire: false, effect: vacuumEffect, trail: "minecraft:bubble_particle" },
  [`${NS}:chorus_tnt`]: { power: 2, breaks: false, fire: false, effect: chorusEffect, trail: "minecraft:endrod" },
  [`${NS}:armageddon_tnt`]: { power: 40, breaks: true, fire: true, effect: armageddonEffect, trail: "minecraft:huge_explosion_emitter", underwater: true },
  [`${NS}:gacha_tnt`]: { power: 2, breaks: true, fire: false, effect: null, isGacha: true, trail: "minecraft:totem_particle" },
};

/* ------------------------------------------------------------------ */
/*  着火条件は通常のTNTと同じ:                                          */
/*   1) 火打石で右クリック                                             */
/*   2) 隣接ブロックが炎・溶岩                                         */
/*   3) レッドストーン通電                                             */
/*   4) 近くの他TNTの爆発に巻き込まれる(連鎖爆発。chainReactionCheckで処理) */
/* ------------------------------------------------------------------ */
const FIRE_NEIGHBORS = new Set([
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

function hasFireOrLavaNeighbor(dimension, loc) {
  const offsets = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ];
  for (const o of offsets) {
    try {
      const b = dimension.getBlock({ x: loc.x + o.x, y: loc.y + o.y, z: loc.z + o.z });
      if (b && FIRE_NEIGHBORS.has(b.typeId)) return true;
    } catch (err) {}
  }
  return false;
}

function isRedstonePowered(block) {
  try {
    const power = block.getRedstonePower();
    return typeof power === "number" && power > 0;
  } catch (err) {
    return false;
  }
}

system.beforeEvents.startup.subscribe((init) => {
  init.blockComponentRegistry.registerCustomComponent(`${NS}:ignite`, {
    // 火打石での着火は、下の world.afterEvents.playerInteractWithBlock 側で検知する。
    // ここに onPlayerInteract を登録すると、ブロック全体が「操作を持つブロック」
    // 扱いになり、しゃがまないと上に物を置けなくなる (Mojang公式Q&Aでも認められている
    // 現状の仕様上の制限)。ワールド全体のイベントで拾えばこの問題を避けられる。

    onTick(e) {
      const { block, dimension } = e;
      const k = keyOf(dimension.id, block.location);
      if (litSet.has(k)) return;
      if (hasFireOrLavaNeighbor(dimension, block.location) || isRedstonePowered(block)) {
        igniteTnt(dimension, block.location, block.typeId);
      }
    },

    // RP/blocks.json の "sound" 設定だけだと機種によって反映されないことがあるため、
    // 設置音・破壊音をスクリプト側でも確実に鳴らす。
    // 本家バニラのTNTは公式に "grass" 系の音を使っているため、それに合わせる。
    onPlace(e) {
      dimension_playSoundSafe(e.dimension, "dig.grass", e.block.location);
    },

    onPlayerDestroy(e) {
      dimension_playSoundSafe(e.dimension, "dig.grass", e.block.location);
    },
  });
});

// 火打石での着火をワールド全体のイベントで検知する。
// ブロックの custom_components に onPlayerInteract を登録しないため、
// TNTブロックは「操作を持たないブロック」のままになり、
// 上にブロックを置く操作にも一切影響しない。
// ※ もしこのイベント自体がこの端末のバージョンに存在しなくても、
//   try/catch で確実に無害化し、スクリプト全体が落ちないようにしてある。
try {
  world.afterEvents.playerInteractWithBlock.subscribe((e) => {
    try {
      const { player, block } = e;
      if (!player || !block || !TNT_TABLE[block.typeId]) return;

      let heldItemId;
      try {
        heldItemId = e.itemStack?.typeId;
      } catch (err) {}

      const dimension = player.dimension;
      const equippable = player.getComponent("minecraft:equippable");
      const mainhand = equippable?.getEquipmentSlot(EquipmentSlot.Mainhand);
      if (!heldItemId && mainhand?.hasItem()) heldItemId = mainhand.typeId;

      if (heldItemId !== "minecraft:flint_and_steel") return;

      const k = keyOf(dimension.id, block.location);
      if (litSet.has(k)) return;

      try {
        if (mainhand && mainhand.hasItem() && mainhand.typeId === "minecraft:flint_and_steel") {
          mainhand.damageDurability(1);
        }
      } catch (err) {}

      igniteTnt(dimension, block.location, block.typeId);
    } catch (err) {}
  });
} catch (err) {
  console.warn(`manytnt: playerInteractWithBlock registration failed: ${err}`);
}

function dimension_playSoundSafe(dimension, soundId, loc) {
  try {
    dimension.playSound(soundId, loc);
  } catch (err) {}
}

/* ------------------------------------------------------------------ */
/*  リモート起爆装置: 手に持って使うと、視線の先(最大64ブロック)にある     */
/*  このアドオンのTNTを遠隔で着火する。                                  */
/* ------------------------------------------------------------------ */
try {
  world.afterEvents.itemUse.subscribe((e) => {
    try {
      const player = e.source;
      const item = e.itemStack;
      if (!player || !item || item.typeId !== `${NS}:detonator`) return;

      const hit = player.getBlockFromViewDirection({ maxDistance: 64 });
      if (!hit || !hit.block || !TNT_TABLE[hit.block.typeId]) {
        try {
          player.onScreenDisplay.setActionBar("§7起爆対象のTNTが見つかりません (64ブロック以内)§r");
        } catch (err) {}
        return;
      }

      const block = hit.block;
      const dimension = player.dimension;
      const k = keyOf(dimension.id, block.location);
      if (litSet.has(k)) return;

      try {
        dimension.playSound("random.click", player.location);
      } catch (err) {}
      igniteTnt(dimension, block.location, block.typeId);
    } catch (err) {}
  });
} catch (err) {
  console.warn(`manytnt: detonator registration failed: ${err}`);
}

/* ------------------------------------------------------------------ */
/*  炎の矢での着火: 本物のTNTは燃えている矢が当たると着火するので再現する。 */
/* ------------------------------------------------------------------ */
try {
  world.afterEvents.projectileHitBlock.subscribe((e) => {
    try {
      const proj = e.projectile;
      if (!proj) return;
      let burning = false;
      try {
        burning = proj.getComponent("minecraft:onfire") !== undefined;
      } catch (err) {}
      if (!burning) return;

      const hit = e.getBlockHit();
      const block = hit?.block;
      if (!block || !TNT_TABLE[block.typeId]) return;

      const dimension = e.dimension;
      const k = keyOf(dimension.id, block.location);
      if (litSet.has(k)) return;
      igniteTnt(dimension, block.location, block.typeId);
    } catch (err) {}
  });
} catch (err) {
  console.warn(`manytnt: projectileHitBlock registration failed: ${err}`);
}

/* ------------------------------------------------------------------ */
/*  着火: 本物の "minecraft:tnt" エンティティを召喚する。                */
/*  導火線の長さ・音・点滅・重力で落ちる/爆風で吹き飛ぶ物理挙動は        */
/*  すべてバニラ本来のTNTエンティティがそのまま処理するので、            */
/*  通常のTNTと完全に同じ挙動になる。                                   */
/* ------------------------------------------------------------------ */
const TAG_PREFIX = "manytnt_type:";

function igniteTnt(dimension, blockLoc, typeId, chained = false) {
  const cfg = TNT_TABLE[typeId];
  if (!cfg) return;
  if (chained) {
    if (recentChainIgnitions >= CHAIN_IGNITION_CAP) return; // 安全上限
    recentChainIgnitions++;
  }
  const k = keyOf(dimension.id, blockLoc);
  if (litSet.has(k)) return;
  litSet.add(k);

  try {
    const block = dimension.getBlock(blockLoc);
    if (block && block.typeId === typeId) {
      block.setType("minecraft:air");
    }
  } catch (err) {}

  let effectiveTypeId = typeId;
  let effectiveCfg = cfg;
  if (cfg.isGacha) {
    const candidates = Object.keys(TNT_TABLE).filter((k) => k !== typeId && !TNT_TABLE[k].isGacha);
    effectiveTypeId = candidates[Math.floor(Math.random() * candidates.length)];
    effectiveCfg = TNT_TABLE[effectiveTypeId];
    const shortName = effectiveTypeId.replace(`${NS}:`, "");
    try {
      dimension.playSound("random.orb", center);
    } catch (err) {}
    announce(`§d🎰 ガチャTNT: §e${shortName}§d が出た！§r`);
  }

  const center = { x: blockLoc.x + 0.5, y: blockLoc.y, z: blockLoc.z + 0.5 };

  // 着火音 (本家のTNTと同じ導火線の音)
  try {
    dimension.playSound("random.fuse", center);
  } catch (err) {}

  let tnt = null;
  try {
    // 本物のバニラTNTエンティティを召喚。導火線・点滅・物理挙動はこれがそのまま担う
    tnt = dimension.spawnEntity("minecraft:tnt", center);
    tnt.addTag(TAG_PREFIX + effectiveTypeId);
    if (effectiveCfg.launchUp) {
      try {
        tnt.applyImpulse({ x: 0, y: 1.8, z: 0 });
      } catch (err) {}
    }
  } catch (err) {}

  litSet.delete(k);
  if (!tnt) return;

  if (chained) {
    // 通常のTNTと同じ仕様: 他の爆発に巻き込まれて着火した場合、
    // 導火線は 10〜30 tick (0.5〜1.5秒) とかなり短くなる。
    // バニラのTNTエンティティ自体の導火線(80tick固定)は script からは
    // 変更できないため、こちらで先回りして早期に爆発させることで再現する。
    const shortFuse = 10 + Math.floor(Math.random() * 21);
    system.runTimeout(() => {
      let loc;
      try {
        loc = { ...tnt.location };
      } catch (err) {
        return; // 既に何らかの理由で消えている
      }
      try {
        tnt.remove();
      } catch (err) {}
      finishExplosion(dimension, loc, typeId, cfg);
    }, shortFuse);
  }

  // 飛んでいる間、色つきパーティクルで種類がわかるようにする。
  // ※ entity.isValid() の呼び出しが機種によっては例外を投げて
  //   ループが1回で止まってしまうことがあったため、
  //   「.location にアクセスできるか」だけで生存判定するようにした。
  const trailParticle = effectiveCfg.trail ?? "minecraft:crit_particle";
  let safetyTicks = 0;
  const trackId = system.runInterval(() => {
    safetyTicks += 4;
    let loc;
    try {
      loc = tnt.location;
    } catch (err) {
      system.clearRun(trackId);
      return;
    }
    if (safetyTicks > 120) {
      // 本家の導火線は4秒(80tick)なので、保険として120tickで必ず止める
      system.clearRun(trackId);
      return;
    }
    try {
      dimension.spawnParticle(trailParticle, {
        x: loc.x + (Math.random() - 0.5) * 0.6,
        y: loc.y + 0.6,
        z: loc.z + (Math.random() - 0.5) * 0.6,
      });
    } catch (err) {}
    if (effectiveCfg.gravityPull) pullNearbyEntities(dimension, loc, 8);
    if (effectiveCfg.magnetPull) pullNearbyItems(dimension, loc, 10);
  }, 4);
}

/* ------------------------------------------------------------------ */
/*  爆発の瞬間を横取りする。                                            */
/*  minecraft:tnt エンティティが爆発すると world.beforeEvents.explosion */
/*  が発火するので、それが「うちのタグ付きTNT」だった場合だけ            */
/*  本来の爆発をキャンセルして、代わりにこちらで威力や特殊効果を適用する。*/
/*  タグの無い(=本物の)TNTや、クリーパー等の爆発には一切干渉しない。     */
/* ------------------------------------------------------------------ */
world.beforeEvents.explosion.subscribe((event) => {
  try {
    const source = event.source;
    const dimension = event.dimension;

    let tag;
    if (source && source.typeId === "minecraft:tnt") {
      try {
        tag = source.getTags().find((t) => t.startsWith(TAG_PREFIX));
      } catch (err) {}
    }

    if (tag) {
      // うちのタグ付きTNT: 本来の爆発をキャンセルして独自処理に差し替える
      const typeId = tag.slice(TAG_PREFIX.length);
      const cfg = TNT_TABLE[typeId];
      if (!cfg) return;

      event.cancel = true;

      let loc;
      try {
        loc = { ...source.location };
      } catch (err) {
        return;
      }

      system.run(() => finishExplosion(dimension, loc, typeId, cfg));
      return;
    }

    // ここに来るのは「うちのTNTではない爆発」= 本物のバニラTNT・クリーパー・
    // ベッド・他アドオンの爆発など。こちらは何もキャンセルせず通常通り爆発させるが、
    // 巻き込まれた場所の近くにうちのTNTがあれば、通常TNT同様に連鎖着火させる。
    try {
      let epicenter = null;
      if (source) {
        try {
          epicenter = { ...source.location };
        } catch (err) {}
      }
      if (!epicenter) {
        try {
          const blocks = event.getImpactedBlocks ? event.getImpactedBlocks() : [];
          if (blocks && blocks.length > 0) {
            epicenter = { x: blocks[0].x, y: blocks[0].y, z: blocks[0].z };
          }
        } catch (err) {}
      }
      if (epicenter) {
        const loc = {
          x: Math.floor(epicenter.x),
          y: Math.floor(epicenter.y),
          z: Math.floor(epicenter.z),
        };
        system.run(() => chainReactionCheck(dimension, loc));
      }
    } catch (err) {}
  } catch (err) {}
});

function finishExplosion(dimension, center, typeId, cfg) {
  recordExplosion(typeId);

  if (cfg.power > 0) {
    // 安全上限のクランプ。威力950で17秒のハング→ウォッチドッグ強制終了を
    // 実際に確認したため、設定ミスや今後の調整で誤って極端な値になっても
    // 致命的なフリーズが起きないよう、ここで必ず上限を掛けておく。
    const safePower = Math.min(cfg.power, 100);
    try {
      dimension.createExplosion(center, safePower, {
        breaksBlocks: cfg.breaks,
        causesFire: cfg.fire,
        allowUnderwater: !!cfg.underwater,
      });
    } catch (err) {}
  } else {
    try {
      dimension.playSound("random.explode", center);
      dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
    } catch (err) {}
  }

  if (cfg.effect) {
    try {
      cfg.effect(dimension, center);
    } catch (err) {
      console.warn(`manytnt effect error: ${err}`);
    }
  }

  chainReactionCheck(dimension, {
    x: Math.floor(center.x),
    y: Math.floor(center.y),
    z: Math.floor(center.z),
  });
}

/* ------------------------------------------------------------------ */
/*  近くの他のTNTを巻き込んで着火させる (連鎖爆発)                       */
/* ------------------------------------------------------------------ */
function chainReactionCheck(dimension, center) {
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const loc = { x: center.x + dx, y: center.y + dy, z: center.z + dz };
        let blk;
        try {
          blk = dimension.getBlock(loc);
        } catch (err) {
          continue;
        }
        if (!blk || !TNT_TABLE[blk.typeId]) continue;
        const k = keyOf(dimension.id, loc);
        if (litSet.has(k)) continue;
        const delay = 2 + Math.floor(Math.random() * 10);
        system.runTimeout(() => igniteTnt(dimension, loc, blk.typeId, true), delay);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  ユーティリティ                                                     */
/* ------------------------------------------------------------------ */
function nearbyEntities(dimension, center, radius, includePlayers = true) {
  try {
    return dimension.getEntities({ location: center, maxDistance: radius });
  } catch (err) {
    return [];
  }
}

function pullNearbyEntities(dimension, center, radius) {
  for (const ent of nearbyEntities(dimension, center, radius)) {
    try {
      const loc = ent.location;
      const dx = center.x - loc.x;
      const dy = center.y - loc.y;
      const dz = center.z - loc.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const strength = 0.12;
      ent.applyImpulse({
        x: (dx / dist) * strength,
        y: (dy / dist) * strength * 0.6,
        z: (dz / dist) * strength,
      });
    } catch (err) {}
  }
}

function pullNearbyItems(dimension, center, radius) {
  for (const ent of nearbyEntities(dimension, center, radius)) {
    if (ent.typeId !== "minecraft:item" && ent.typeId !== "minecraft:xp_orb") continue;
    try {
      const loc = ent.location;
      const dx = center.x - loc.x;
      const dy = center.y - loc.y;
      const dz = center.z - loc.z;
      const dist = Math.max(0.3, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const strength = 0.25;
      ent.applyImpulse({
        x: (dx / dist) * strength,
        y: (dy / dist) * strength * 0.5,
        z: (dz / dist) * strength,
      });
    } catch (err) {}
  }
}

/** 指定した候補の中から、実際にセットできたブロックIDを返す */
function trySetBlock(dimension, loc, candidates) {
  for (const id of candidates) {
    try {
      const b = dimension.getBlock(loc);
      if (!b) return false;
      b.setType(id);
      return true;
    } catch (err) {
      /* 次の候補を試す */
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  各TNTタイプの特殊効果                                              */
/* ------------------------------------------------------------------ */

/* ==================================================================== */
/*  重量級TNT(核・超核・水素爆弾)共通ヘルパー                            */
/*                                                                      */
/*  【最適化について】                                                   */
/*  以前の核TNTは「威力22の爆発を即座に1発」→「さらに威力8の爆発を4発、  */
/*  ほぼ同時に畳み掛ける」実装になっており、爆発判定(だいたい威力の3乗に  */
/*  比例して重くなる)が短時間に集中してカクつき/重さの原因になっていた。 */
/*  そこで今は「1tickにつき爆発は1発まで」に統一し、必ず数tickずつ間隔を */
/*  空けて発生させることで、瞬間的な負荷の山ができないようにしている。   */
/* ==================================================================== */

/* きのこ雲用ヘルパー */
function rand(a, b) {
  return a + Math.random() * (b - a);
}
function spawnP(dimension, id, loc) {
  try {
    dimension.spawnParticle(id, loc);
  } catch (err) {}
}

/**
 * リアル志向のきのこ雲。実際の核爆発の段階を順番に再現する:
 *  1) 閃光         … 爆発直後、中心が真っ白に光る
 *  2) 火球の上昇   … 燃える球が膨らみながら立ち上る
 *  3) 幹(スモーク柱)… 根本から太い煙が終始立ち上り続ける
 *  4) 傘           … 頂上でドーム状に外へ巻き広がる。下面は火に照らされる
 *  5) ベースサージ … 地表を這って外側へ広がる土煙のリング
 *  6) 火の粉       … 全体に舞う燃えかす
 * パーティクルはすべて時間分散で発生させるので負荷の山はできない。
 */
function mushroomCloud(dimension, center, opts = {}) {
  const stemHeight = opts.stemHeight ?? 12;
  const capRadius = opts.capRadius ?? 10;
  const duration = opts.duration ?? 60;
  const lingerTicks = opts.lingerTicks ?? 140; // 完成後もこの時間だけ雲を維持する
  const densityMult = opts.densityMult ?? 1; // 段階が上がるほど大きくして密度を上げる
  const stemRadius = Math.max(1.5, capRadius * 0.18);

  // 1) 閃光
  for (let n = 0; n < 16; n++) {
    system.runTimeout(() => {
      spawnP(dimension, "minecraft:huge_explosion_emitter", {
        x: center.x + rand(-3, 3),
        y: center.y + rand(0, 4),
        z: center.z + rand(-3, 3),
      });
    }, Math.floor(n / 5));
  }

  // 2) 火球の上昇
  const riseT = Math.max(10, Math.floor(duration * 0.35));
  for (let t = 0; t <= riseT; t += 2) {
    const prog = t / riseT;
    const y = center.y + stemHeight * prog;
    const r = 1.5 + (stemRadius + 1.5) * prog;
    system.runTimeout(() => {
      for (let i = 0; i < Math.round(10 * densityMult); i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = r * Math.sqrt(Math.random());
        spawnP(dimension, "minecraft:basic_flame_particle", {
          x: center.x + Math.cos(a) * rr,
          y: y + rand(-1, 1),
          z: center.z + Math.sin(a) * rr,
        });
      }
      spawnP(dimension, "minecraft:huge_explosion_emitter", {
        x: center.x + rand(-1, 1),
        y,
        z: center.z + rand(-1, 1),
      });
    }, t);
  }

  // 3) 幹のスモーク柱 (campfire smoke は自力で上昇するので柱がよく伸びる)。
  //    形成期間(duration)が終わった後も lingerTicks の間、薄くなりつつ供給し続ける。
  const stemTotal = duration + lingerTicks;
  for (let t = 0; t <= stemTotal; t += 2) {
    const fadeOut = t > duration ? Math.max(0.15, 1 - (t - duration) / lingerTicks) : 1;
    const count = Math.max(1, Math.round(7 * fadeOut * densityMult));
    system.runTimeout(() => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = stemRadius * Math.sqrt(Math.random());
        const h = Math.random() * stemHeight * 0.9;
        spawnP(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * rr,
          y: center.y + h,
          z: center.z + Math.sin(a) * rr,
        });
      }
    }, t);
  }

  // 4) 傘: 頂上でドーム状に外へ巻き広がる (密度アップ)
  const capSteps = 16;
  for (let s = 0; s <= capSteps; s++) {
    const prog = s / capSteps;
    const r = capRadius * (0.25 + 0.75 * prog);
    const t = riseT + Math.floor((duration - riseT) * prog * 0.8);
    system.runTimeout(() => {
      const pts = Math.round((14 + r * 1.8) * densityMult);
      for (let p = 0; p < pts; p++) {
        const a = (Math.PI * 2 * p) / pts + Math.random() * 0.3;
        const jitter = rand(-0.8, 0.8);
        // 傘の上面 (外側ほど低く、中心ほど盛り上がるドーム形状)
        spawnP(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * (r + jitter),
          y: center.y + stemHeight + Math.max(0, (1 - prog) * capRadius * 0.25) + rand(0, 1.5),
          z: center.z + Math.sin(a) * (r + jitter),
        });
        // 傘の下面が火球に照らされている表現
        if (p % 2 === 0) {
          spawnP(dimension, "minecraft:basic_flame_particle", {
            x: center.x + Math.cos(a) * r * 0.85,
            y: center.y + stemHeight - 1 + rand(-0.5, 0.5),
            z: center.z + Math.sin(a) * r * 0.85,
          });
        }
      }
    }, t);
  }

  // 4.5) 傘の維持フェーズ: 形成が終わった後も lingerTicks の間、
  //      傘の輪郭に沿ってパーティクルを供給し続け、雲が留まって見えるようにする。
  const capLingerSteps = Math.max(4, Math.floor(lingerTicks / 8));
  for (let s = 0; s <= capLingerSteps; s++) {
    const t = duration + s * 8;
    const fadeOut = Math.max(0.2, 1 - s / capLingerSteps);
    system.runTimeout(() => {
      const pts = Math.max(6, Math.floor(capRadius * 1.4 * fadeOut * densityMult));
      for (let p = 0; p < pts; p++) {
        const a = Math.random() * Math.PI * 2;
        const r = capRadius * (0.3 + 0.7 * Math.sqrt(Math.random()));
        spawnP(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * r,
          y: center.y + stemHeight + rand(-0.5, 2),
          z: center.z + Math.sin(a) * r,
        });
      }
    }, t);
  }

  // 5) ベースサージ (地表を這う土煙の輪)
  const surgeSteps = 14;
  const surgeR = capRadius * 1.6;
  for (let s = 0; s <= surgeSteps; s++) {
    const prog = s / surgeSteps;
    const r = surgeR * prog + 2;
    system.runTimeout(() => {
      const pts = Math.round((16 + r * 1.5) * densityMult);
      for (let p = 0; p < pts; p++) {
        const a = (Math.PI * 2 * p) / pts + Math.random() * 0.4;
        spawnP(dimension, "minecraft:basic_smoke_particle", {
          x: center.x + Math.cos(a) * r,
          y: center.y + 0.5 + Math.random(),
          z: center.z + Math.sin(a) * r,
        });
      }
    }, Math.floor(prog * duration * 0.4));
  }

  // 6) 火の粉 (形成中〜維持フェーズを通して降らせ続ける)
  for (let n = 0; n < Math.floor((duration + lingerTicks) / 2); n++) {
    system.runTimeout(() => {
      for (let i = 0; i < Math.max(1, Math.round(densityMult)); i++) {
        spawnP(dimension, "minecraft:crit_particle", {
          x: center.x + rand(-capRadius, capRadius),
          y: center.y + rand(1, stemHeight),
          z: center.z + rand(-capRadius, capRadius),
        });
      }
    }, n * 2);
  }
}

/** 広範囲の爆風の余波でエンティティを吹き飛ばす */
function shockwaveKnockback(dimension, center, radius, maxStrength) {
  for (const ent of nearbyEntities(dimension, center, radius)) {
    try {
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(1, Math.sqrt(dx * dx + dz * dz));
      const strength = Math.max(0.3, maxStrength - (dist / radius) * maxStrength);
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, strength);
    } catch (err) {}
  }
}

/**
 * 爆心地に残留する放射能ダメージ。
 * 追加の爆発は一切起こさず、範囲内のエンティティに定期的に
 * ウィザー効果(じわじわ削れるダメージ)を付与するだけなので、
 * 何回爆発を重ねても重くならない。
 */
/**
 * 爆心地に残留する放射能ダメージ。
 * ゾーン内にいる間は一定間隔でウィザー効果を「塗り直す」だけでなく、
 * 塗り直すたびに lingerTicks 分の残り時間を与えるので、
 * ゾーンを一瞬でも通過すればその後ゾーンの外に出ても
 * 最低 lingerTicks 分は被曝ダメージが継続する(=放射能に汚染された扱い)。
 * 追加の爆発は一切起こさないので、何回重ねても処理は軽いまま。
 */
function radiationZone(dimension, center, opts) {
  const radius = opts.radius ?? 6;
  const duration = opts.duration ?? 600; // ゾーン自体が持続する時間 (tick)
  const amplifier = opts.amplifier ?? 0;
  const lingerTicks = opts.lingerTicks ?? 300; // ゾーンを出た後も保証される被曝時間 (tick)
  const tickInterval = 20;
  let elapsed = 0;
  const id = system.runInterval(() => {
    elapsed += tickInterval;
    for (const ent of nearbyEntities(dimension, center, radius)) {
      try {
        ent.addEffect("minecraft:wither", lingerTicks, { amplifier, showParticles: true });
      } catch (err) {}
    }
    try {
      dimension.spawnParticle("minecraft:mob_spell_particle", {
        x: center.x + (Math.random() - 0.5) * radius * 1.6,
        y: center.y + 0.3,
        z: center.z + (Math.random() - 0.5) * radius * 1.6,
      });
    } catch (err) {}
    if (elapsed >= duration) system.clearRun(id);
  }, tickInterval);
}

/**
 * 核系TNT(核・超核・水素爆弾)は、爆発そのものは
 * メガTNTと全く同じ「単発の createExplosion」方式にしてある。
 * 爆発を何発も追加すると威力を上げるほど重くなってしまうため、
 * 見た目・演出面(きのこ雲、追加の火、放射能ダメージ)だけを
 * 派手にすることで、処理を増やさずに規模の違いを表現している。
 */
/**
 * 壁越しでも届く直接ダメージ。
 * dimension.createExplosion のダメージは間に壁があると軽減/無効化されるが、
 * 核系TNTは「爆風というより爆心地の熱線・放射線」のイメージなので、
 * 遮蔽物に関係なく範囲内のモブに直接ダメージを与える。
 * 中心に近いほど大ダメージ、外側ほど弱まる。
 */
/**
 * 耐爆性を無視して、指定した円柱状の範囲を強制的に更地にする「衝撃波」。
 * dimension.createExplosion は硬いブロックに当たるとすぐ威力を使い切ってしまい、
 * 横方向にはあまり広がらない(公式Wikiにある通りの仕様)。
 *
 * 最初は耐爆性を無視して強制的に更地にする方式を試したが、綺麗な円形に
 * くり抜かれて不自然だった。次に完全ランダムな点をばら撒く方式にしたが、
 * 今度は隙間だらけの「まばら」な見た目になってしまった。
 *
 * そこで今の方式: 中心から外側へ何重ものリング状に爆発点を並べ、
 * 角度と半径の両方に少しジッター(ランダムなブレ)を入れることで、
 * 「隙間なく埋まっているのに、完全な円ではない」クレーターを作る。
 * リング半径に応じて爆発のY座標を下げることで、中心が深く外側ほど
 * 浅くなる、すり鉢状(中心が深いクレーター)の断面になる。外周は間引いて
 * 輪郭を不揃いにする。点の総数(count)は半径に関係なく一定に保っている
 * ので、どれだけ範囲を広げても重くならない。
 */
/**
 * 耐爆性を完全に無視して、指定した球状の範囲を直接破壊する。
 * dimension.createExplosion は「本物の爆発」である以上、必ず
 * ブロックの耐爆性で威力を消費されるため、絶対にこの上限を超えられない
 * (Minecraft自体のアルゴリズムであり、設定で解除することはできない)。
 * そこでここでは爆発そのものを使わず、ブロックを直接 air に置き換える
 * ことで、地形の硬さに一切左右されない「純粋な破壊範囲」を実現する。
 * bedrock・水・溶岩・コマンドブロック等は対象外にしてある。
 */
const INDESTRUCTIBLE_BLOCKS = new Set([
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:end_portal_frame",
  "minecraft:end_portal",
  "minecraft:end_gateway",
  "minecraft:command_block",
  "minecraft:repeating_command_block",
  "minecraft:chain_command_block",
  "minecraft:structure_block",
  "minecraft:jigsaw",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

function clearBlast(dimension, center, r) {
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const cz = Math.round(center.z);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 > r * r) continue;
        // 表面付近(半径の70%〜100%)だけ、確率的に間引いてギザギザの輪郭にする
        const distRatio = Math.sqrt(dist2) / r;
        if (distRatio > 0.7 && Math.random() < ((distRatio - 0.7) / 0.3) * 0.6) continue;
        try {
          const b = dimension.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
          if (!b || b.typeId === "minecraft:air" || INDESTRUCTIBLE_BLOCKS.has(b.typeId)) continue;
          b.setType("minecraft:air");
        } catch (err) {}
      }
    }
  }
}

function craterBurst(dimension, center, opts) {
  const { radius, count, basePower, coreCount = 3, corePower = 0, dome = 3, pointRadius = 3 } = opts;
  const cp = corePower || basePower + 6;

  // フェーズ1: 爆心地への即時集中爆発 (本物の爆発。音・炎・ノックバック等の「体感」用)
  for (let i = 0; i < coreCount; i++) {
    const delay = 1 + i;
    const ox = i === 0 ? 0 : rand(-2, 2);
    const oz = i === 0 ? 0 : rand(-2, 2);
    system.runTimeout(() => {
      try {
        dimension.createExplosion(
          { x: center.x + ox, y: center.y - dome * 0.5 + rand(-0.5, 1), z: center.z + oz },
          cp,
          { breaksBlocks: true, causesFire: true, allowUnderwater: true }
        );
      } catch (err) {}
    }, delay);
  }

  // フェーズ2: リング状に密集配置した「純粋な破壊」ポイント
  const ringCount = Math.max(3, Math.round(Math.sqrt(count)));
  const points = [];
  for (let ring = 1; ring <= ringCount; ring++) {
    const ringFrac = ring / ringCount;
    const ringR = radius * ringFrac;
    // 外側のリングほど円周が長くなる分、点数も比例して増やし隙間を作らない
    const ptsInRing = Math.max(4, Math.round((count * (2 * ring - 1)) / (ringCount * ringCount)));
    for (let p = 0; p < ptsInRing; p++) {
      // 完全な円にしないための角度・半径のジッター
      const angle = (2 * Math.PI * p) / ptsInRing + rand(-0.4, 0.4);
      const rJitter = ringR + rand(-radius * 0.08, radius * 0.08);
      // 外周20%はランダムに間引いて輪郭をギザギザにする
      if (ringFrac > 0.8 && Math.random() < (ringFrac - 0.8) * 3.5) continue;
      points.push({ ox: Math.cos(angle) * rJitter, oz: Math.sin(angle) * rJitter, r: ringR });
    }
  }
  // 内側から外側の順に発生させる(自然な広がり方に見える)
  points.sort((a, b) => a.r - b.r);

  let delay = 1 + coreCount;
  for (const pt of points) {
    // クレーター断面: 中心に近いほど深く、外側ほど浅くなる、すり鉢状の断面
    const domeY = -dome * (1 - Math.pow(pt.r / radius, 1.3)) + rand(-0.8, 0.8);
    const d = delay;
    const loc = { x: center.x + pt.ox, y: center.y + domeY, z: center.z + pt.oz };
    system.runTimeout(() => {
      // 1. 保証された範囲を確実に破壊する(耐爆性を無視)
      clearBlast(dimension, loc, pointRadius);
      // 2. 同じ場所に本物の小さな爆発も重ねて起こす。
      //    実際の explosion なので、焦げ跡・自然な発火・爆風の音・
      //    周辺の巻き込み破壊など「本物の爆発」らしい質感を追加する。
      //    範囲は clearBlast で既に保証済みなので、威力は控えめでよい。
      try {
        dimension.createExplosion(loc, Math.max(4, pointRadius * 1.5), {
          breaksBlocks: true,
          causesFire: true,
          allowUnderwater: true,
        });
      } catch (err) {}
    }, d);
    delay += 1;
  }
}

/**
 * 核系爆発の「体感」を作る: 周囲プレイヤーの画面を揺らし、
 * 通常の爆発音に低いピッチの爆発音を重ねて重低音のドォンを演出する。
 */
function nukeImpact(dimension, center, radius, intensity, seconds) {
  try {
    const x = Math.floor(center.x);
    const y = Math.floor(center.y);
    const z = Math.floor(center.z);
    dimension.runCommand(
      `camerashake add @a[x=${x},y=${y},z=${z},r=${radius}] ${intensity} ${seconds} positional`
    );
  } catch (err) {}
  try {
    dimension.playSound("random.explode", center, { volume: 6, pitch: 0.55 });
  } catch (err) {}
  system.runTimeout(() => {
    try {
      dimension.playSound("random.explode", center, { volume: 5, pitch: 0.4 });
    } catch (err) {}
  }, 4);
}

/**
 * 壁を完全に無視して届く直接ダメージ。
 * 実際の核爆発と同じく2段構成:
 *  1発目 = 熱線 (即時、フルダメージ)
 *  2発目 = 爆風の到達 (少し遅れて半分のダメージ + 上方向へ吹き飛ばし)
 * どちらも遮蔽物・壁に関係なく範囲内の全モブに届く。
 */
function irradiateEntities(dimension, center, radius, maxDamage) {
  const pulse = (damageScale, launch) => {
    for (const ent of nearbyEntities(dimension, center, radius)) {
      if (ent.typeId === "minecraft:item" || ent.typeId === "minecraft:xp_orb") continue;
      try {
        const loc = ent.location;
        const dx = loc.x - center.x;
        const dy = loc.y - center.y;
        const dz = loc.z - center.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const falloff = Math.max(0, 1 - dist / radius);
        const dmg = Math.max(2, maxDamage * damageScale * falloff);
        ent.applyDamage(dmg, { cause: "entityExplosion" });
        if (launch && falloff > 0.15) {
          ent.applyImpulse({ x: 0, y: 0.6 * falloff, z: 0 });
        }
      } catch (err) {}
    }
  };
  pulse(1.0, false); // 熱線
  system.runTimeout(() => pulse(0.5, true), 8); // 爆風到達
}

function nukeEffect(dimension, center) {
  try {
    announce("§c☢ 核TNTが爆発した！§r");
  } catch (err) {}
  mushroomCloud(dimension, center, { stemHeight: 14, capRadius: 10, duration: 60, lingerTicks: 140, densityMult: 1.0 });
  fireEffect(dimension, center, 6);
  radiationZone(dimension, center, { radius: 8, duration: 600, amplifier: 0, lingerTicks: 300 });
  shockwaveKnockback(dimension, center, 18, 1.5);
  irradiateEntities(dimension, center, 20, 35);
  craterBurst(dimension, center, { radius: 18, count: 20, basePower: 12, coreCount: 4, corePower: 18, dome: 3, pointRadius: 3 });
  nukeImpact(dimension, center, 50, 0.6, 1.8);
}

function ultraNukeEffect(dimension, center) {
  try {
    announce("§4§l☢☢☢ 超核TNTが爆発した...世界が震える ☢☢☢§r");
  } catch (err) {}
  mushroomCloud(dimension, center, { stemHeight: 22, capRadius: 17, duration: 90, lingerTicks: 180, densityMult: 1.3 });
  fireEffect(dimension, center, 10);
  radiationZone(dimension, center, { radius: 13, duration: 1000, amplifier: 1, lingerTicks: 500 });
  shockwaveKnockback(dimension, center, 30, 2.0);
  irradiateEntities(dimension, center, 30, 50);
  craterBurst(dimension, center, { radius: 40, count: 50, basePower: 15, coreCount: 5, corePower: 23, dome: 4, pointRadius: 4 });
  nukeImpact(dimension, center, 75, 0.8, 2.6);
}

function hydrogenBombEffect(dimension, center) {
  try {
    announce("§5§l☢☢☢☢☢ 水素爆弾が炸裂した...大地が消し飛ぶ ☢☢☢☢☢§r");
  } catch (err) {}
  mushroomCloud(dimension, center, { stemHeight: 34, capRadius: 27, duration: 130, lingerTicks: 220, densityMult: 1.6 });
  fireEffect(dimension, center, 14);
  radiationZone(dimension, center, { radius: 20, duration: 1800, amplifier: 2, lingerTicks: 1200 });
  shockwaveKnockback(dimension, center, 46, 2.6);
  irradiateEntities(dimension, center, 42, 70);
  craterBurst(dimension, center, { radius: 72, count: 128, basePower: 19, coreCount: 6, corePower: 29, dome: 5, pointRadius: 5 });
  nukeImpact(dimension, center, 110, 0.95, 3.5);
}

/**
 * ツァーリボンバ(弱体化前の100メガトン版)。
 *
 * 実際の記録:
 * ・実験で使われた50メガトン版でも、火球半径 約4.6km、全壊半径 約35km
 * ・弱体化前の100メガトン設計は、その約1.26倍(降伏出力の立方根比)相当と
 *   推定されており、全壊半径は概算で40〜45km、火球は直径10kmに達したとされる
 * ・きのこ雲は実測で高度60〜64km(50メガトン版)
 *
 * これをMinecraftで「完璧に」1ブロック=1mでそのまま再現しようとすると、
 * 半径44kmはブロック数にして一辺88,000ブロック超・面積は約77億ブロックの
 * 爆発判定が必要になり、どんな端末でも即クラッシュする規模のため不可能。
 * そのため、このアドオンの中で最大威力・最大範囲・最長持続の演出にすることで、
 * 実際の桁違いのスケール感をゲームが処理できる範囲で表現している。
 */
function tsarBombaEffect(dimension, center) {
  try {
    announce("§d§l☢☢☢☢☢☢☢ ツァーリボンバ(100メガトン)が炸裂した ☢☢☢☢☢☢☢§r");
    announce("§7実際の規模なら全壊半径は約44km、火球は直径10km超え§r");
  } catch (err) {}
  mushroomCloud(dimension, center, { stemHeight: 48, capRadius: 38, duration: 170, lingerTicks: 260, densityMult: 2.0 });
  fireEffect(dimension, center, 18);
  radiationZone(dimension, center, { radius: 28, duration: 2400, amplifier: 3, lingerTicks: 2400 });
  shockwaveKnockback(dimension, center, 70, 3.4);
  irradiateEntities(dimension, center, 60, 95);
  craterBurst(dimension, center, { radius: 115, count: 270, basePower: 24, coreCount: 7, corePower: 36, dome: 6, pointRadius: 6 });
  nukeImpact(dimension, center, 160, 1.0, 5.0);
}

/**
 * 反物質爆弾。核分裂・核融合の先、物質と反物質の対消滅を再現した、
 * このアドオンの頂点に立つ「最強最悪」の一撃。
 *
 * 【威力について】単発の createExplosion は、Minecraft自体の仕様で
 * 威力(半径)をどれだけ上げても、光線が地面の耐爆性で威力を使い切ってしまう
 * ため、ある一定値を超えると見た目の破壊範囲がほぼ変わらなくなる
 * (公式Wikiにも明記されている仕様で、実際に威力950で17秒のハングも確認済み)。
 * これは設定で解除できるものではなく、Minecraft自身の爆発アルゴリズムの
 * 根本的な限界。そのため単発の威力は安全な範囲(最大80)に抑えつつ、
 * 実質的に範囲制限を超えるために craterBurst で複数箇所に爆発を
 * 分散させ、水平方向の破壊範囲を段階ごとに大きく伸ばしている。
 */
function antimatterEffect(dimension, center) {
  try {
    announce("§f§l⚛⚛⚛ 反物質爆弾が対消滅を起こした...この世の終わりだ ⚛⚛⚛§r");
  } catch (err) {}
  mushroomCloud(dimension, center, { stemHeight: 64, capRadius: 50, duration: 200, lingerTicks: 300, densityMult: 2.5 });
  fireEffect(dimension, center, 22);
  radiationZone(dimension, center, { radius: 36, duration: 6000, amplifier: 4, lingerTicks: 3600 });
  shockwaveKnockback(dimension, center, 90, 3.8);
  irradiateEntities(dimension, center, 80, 110);
  craterBurst(dimension, center, { radius: 175, count: 524, basePower: 30, coreCount: 9, corePower: 44, dome: 8, pointRadius: 7 });
  nukeImpact(dimension, center, 220, 1.0, 6.0);
}

function iceEffect(dimension, center) {
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

function poisonEffect(dimension, center) {
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

function fireEffect(dimension, center, radius = 4) {
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

function thunderEffect(dimension, center) {
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

function gravityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, 1.4);
    } catch (err) {}
  }
}

function teleportEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      const dx = Math.floor((Math.random() - 0.5) * 24);
      const dz = Math.floor((Math.random() - 0.5) * 24);
      ent.teleport({ x: center.x + dx, y: center.y + 2, z: center.z + dz }, { dimension });
    } catch (err) {}
  }
}

function healEffect(dimension, center) {
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

function confettiEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:jump_boost", 200, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:speed", 200, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }
  try {
    dimension.playSound("random.levelup", center);
  } catch (err) {}
  for (let n = 0; n < 16; n++) {
    try {
      dimension.spawnParticle("minecraft:totem_particle", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y + Math.random() * 3,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
  }
}

function magnetBurstEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    if (ent.typeId !== "minecraft:item" && ent.typeId !== "minecraft:xp_orb") continue;
    try {
      ent.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.3, z: (Math.random() - 0.5) * 0.3 });
    } catch (err) {}
  }
  try {
    dimension.spawnParticle("minecraft:villager_happy", center);
  } catch (err) {}
}

function antiGravityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      ent.applyImpulse({ x: 0, y: 1.4, z: 0 });
      ent.addEffect("minecraft:levitation", 60, { amplifier: 4, showParticles: true });
    } catch (err) {}
  }
  try {
    dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
  } catch (err) {}
}

function lavaEffect(dimension, center) {
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

function waterEffect(dimension, center) {
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

function darknessEffect(dimension, center) {
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

const SUMMON_MOBS = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider"];
function summonEffect(dimension, center) {
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

function earthquakeEffect(dimension, center) {
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

function bouncyEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.applyImpulse({ x: (Math.random() - 0.5) * 0.4, y: 1.6, z: (Math.random() - 0.5) * 0.4 });
      ent.addEffect("minecraft:jump_boost", 100, { amplifier: 3, showParticles: false });
    } catch (err) {}
  }
  try {
    dimension.playSound("mob.slime.big", center);
  } catch (err) {}
}

function webEffect(dimension, center) {
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

const TREASURE_ITEMS = ["minecraft:emerald", "minecraft:gold_ingot", "minecraft:diamond", "minecraft:iron_ingot"];
function treasureEffect(dimension, center) {
  for (let i = 0; i < 8; i++) {
    try {
      const itemId = TREASURE_ITEMS[Math.floor(Math.random() * TREASURE_ITEMS.length)];
      const stack = new ItemStack(itemId, 1 + Math.floor(Math.random() * 3));
      const item = dimension.spawnItem(stack, {
        x: center.x + (Math.random() - 0.5) * 2,
        y: center.y + 0.5,
        z: center.z + (Math.random() - 0.5) * 2,
      });
      item.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3 });
    } catch (err) {}
  }
  try {
    dimension.playSound("random.levelup", center);
  } catch (err) {}
}

function swapEffect(dimension, center) {
  const ents = nearbyEntities(dimension, center, 10).filter((e) => e.typeId !== "minecraft:item");
  if (ents.length < 2) return;
  ents.sort((a, b) => {
    const da = distSq(a.location, center);
    const db = distSq(b.location, center);
    return da - db;
  });
  const a = ents[0];
  const b = ents[1];
  try {
    const locA = { ...a.location };
    const locB = { ...b.location };
    a.teleport(locB, { dimension });
    b.teleport(locA, { dimension });
    dimension.spawnParticle("minecraft:endrod", locA);
    dimension.spawnParticle("minecraft:endrod", locB);
  } catch (err) {}
}

function distSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function confusionEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:nausea", 160, { amplifier: 2, showParticles: false });
      ent.addEffect("minecraft:slowness", 80, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }
  for (let n = 0; n < 10; n++) {
    try {
      dimension.spawnParticle("minecraft:mob_spell_particle", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
}

/**
 * ブラックホールTNT: 広範囲を数秒かけて中心に吸い込み、
 * 中心付近のブロックを消し去った後、最後に一気に弾け飛ばす。
 */
function blackholeEffect(dimension, center) {
  try {
    announce("§5§l●黒 ブラックホールTNTが空間を歪めた ●黒§r");
  } catch (err) {}

  const radius = 16;
  let pulls = 0;
  const pullId = system.runInterval(() => {
    pulls++;
    for (const ent of nearbyEntities(dimension, center, radius)) {
      try {
        const loc = ent.location;
        const dx = center.x - loc.x;
        const dy = center.y - loc.y;
        const dz = center.z - loc.z;
        const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
        const strength = 0.3;
        ent.applyImpulse({
          x: (dx / dist) * strength,
          y: (dy / dist) * strength * 0.5,
          z: (dz / dist) * strength,
        });
      } catch (err) {}
    }
    for (let n = 0; n < 6; n++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 5;
      try {
        dimension.spawnParticle("minecraft:basic_smoke_particle", {
          x: center.x + Math.cos(ang) * r,
          y: center.y + (Math.random() - 0.5) * 3,
          z: center.z + Math.sin(ang) * r,
        });
      } catch (err) {}
    }
    if (pulls >= 12) {
      system.clearRun(pullId);
      // 中心付近のブロックを消し去る (吸い込まれた跡)
      const R = 3;
      for (let dx = -R; dx <= R; dx++) {
        for (let dy = -R; dy <= R; dy++) {
          for (let dz = -R; dz <= R; dz++) {
            if (dx * dx + dy * dy + dz * dz > R * R) continue;
            try {
              const b = dimension.getBlock({ x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz });
              if (b && b.typeId !== "minecraft:bedrock") b.setType("minecraft:air");
            } catch (err) {}
          }
        }
      }
      try {
        dimension.createExplosion(center, 6, { breaksBlocks: false, causesFire: false });
      } catch (err) {}
      shockwaveKnockback(dimension, center, 16, 2.0);
    }
  }, 4);
}

/**
 * ディスコTNT: 足元を一時的にカラフルな床に変え、音楽と共に踊らせる。
 * 変化させたブロックは元に戻す。
 */
function discoEffect(dimension, center) {
  try {
    announce("§d♪ ディスコTNTが踊り出した ♪§r");
  } catch (err) {}

  const colors = [
    "minecraft:red_concrete", "minecraft:yellow_concrete", "minecraft:lime_concrete",
    "minecraft:light_blue_concrete", "minecraft:purple_concrete", "minecraft:magenta_concrete",
  ];
  const R = 4;
  const baseY = Math.floor(center.y) - 1;
  const originals = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: baseY, z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (!b || b.typeId === "minecraft:air") continue;
        originals.push({ loc, typeId: b.typeId });
      } catch (err) {}
    }
  }

  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:speed", 140, { amplifier: 1, showParticles: false });
      ent.addEffect("minecraft:jump_boost", 140, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }

  let beat = 0;
  const beatId = system.runInterval(() => {
    beat++;
    for (const o of originals) {
      try {
        trySetBlock(dimension, o.loc, [colors[Math.floor(Math.random() * colors.length)]]);
      } catch (err) {}
    }
    try {
      dimension.playSound("random.orb", center);
      dimension.spawnParticle("minecraft:totem_particle", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
    if (beat >= 7) {
      system.clearRun(beatId);
      for (const o of originals) {
        try {
          trySetBlock(dimension, o.loc, [o.typeId]);
        } catch (err) {}
      }
    }
  }, 8);
}

/**
 * UFO襲来TNT: 緑の光の柱と共に周囲を空に持ち上げる(浮遊効果)。
 */
function ufoEffect(dimension, center) {
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

/**
 * 花火大乱舞TNT: 打ち上げ花火を大量に打ち上げる、無害でド派手な演出TNT。
 */
function fireworksEffect(dimension, center) {
  try {
    announce("§e✨ 花火大乱舞TNT ✨§r");
  } catch (err) {}
  for (let i = 0; i < 14; i++) {
    system.runTimeout(() => {
      try {
        const loc = {
          x: center.x + (Math.random() - 0.5) * 6,
          y: center.y + Math.random() * 2,
          z: center.z + (Math.random() - 0.5) * 6,
        };
        const rocket = dimension.spawnEntity("minecraft:fireworks_rocket", loc);
        rocket.applyImpulse({ x: (Math.random() - 0.5) * 0.2, y: 1.2 + Math.random() * 0.6, z: (Math.random() - 0.5) * 0.2 });
      } catch (err) {}
    }, i * 3);
  }
}

/**
 * 隕石雨TNT: 空から隕石(炎の軌跡+着弾爆発)が何発も降ってくる。
 */
function meteorEffect(dimension, center) {
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

/**
 * 呪いTNT: 弱体化の詰め合わせを叩き込む、不穏な雰囲気のTNT。
 */
function curseEffect(dimension, center) {
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

function rainbowEffect(dimension, center) {
  const pool = [
    nukeEffect, iceEffect, poisonEffect, fireEffect, thunderEffect, teleportEffect,
    healEffect, confettiEffect, antiGravityEffect, lavaEffect, waterEffect,
    darknessEffect, summonEffect, earthquakeEffect, bouncyEffect, webEffect,
    treasureEffect, swapEffect, confusionEffect, grassEffect, desertEffect,
    snowgolemEffect, beeEffect, arrowEffect, musicEffect, tsunamiEffect,
    harvestEffect, xpEffect, slimeEffect, animalEffect, honeyEffect,
    feastEffect, cactusEffect, glowEffect, chorusEffect,
  ];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try {
    announce(`§d虹TNT: ${pick.name} が発動！§r`);
  } catch (err) {}
  pick(dimension, center);
}

function grassEffect(dimension, center) {
  const PLANTS = ["minecraft:short_grass", "minecraft:poppy", "minecraft:dandelion", "minecraft:blue_orchid", "minecraft:allium"];
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      if (Math.random() > 0.4) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (b && b.typeId === "minecraft:air" && below &&
            (below.typeId === "minecraft:grass_block" || below.typeId === "minecraft:dirt")) {
          trySetBlock(dimension, loc, [PLANTS[Math.floor(Math.random() * PLANTS.length)]]);
        }
      } catch (err) {}
    }
  }
}

function desertEffect(dimension, center) {
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

function snowgolemEffect(dimension, center) {
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

function beeEffect(dimension, center) {
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

function arrowEffect(dimension, center) {
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    try {
      const arrow = dimension.spawnEntity("minecraft:arrow", {
        x: center.x,
        y: center.y + 1,
        z: center.z,
      });
      arrow.applyImpulse({ x: Math.cos(angle) * 1.2, y: 0.1, z: Math.sin(angle) * 1.2 });
    } catch (err) {}
  }
}

function musicEffect(dimension, center) {
  const notes = [0, 4, 7, 12, 7, 4, 0];
  notes.forEach((n, i) => {
    system.runTimeout(() => {
      try {
        dimension.playSound("note.harp", center, { pitch: Math.pow(2, n / 12) });
        dimension.spawnParticle("minecraft:totem_particle", {
          x: center.x + (Math.random() - 0.5) * 2,
          y: center.y + 1 + Math.random(),
          z: center.z + (Math.random() - 0.5) * 2,
        });
      } catch (err) {}
    }, i * 4);
  });
}

function tsunamiEffect(dimension, center) {
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R || Math.random() > 0.3) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (b && b.typeId === "minecraft:air") trySetBlock(dimension, loc, ["minecraft:water"]);
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
  system.runTimeout(() => {
    const R2 = 5;
    for (let dx = -R2; dx <= R2; dx++) {
      for (let dz = -R2; dz <= R2; dz++) {
        try {
          const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
          const b = dimension.getBlock(loc);
          if (b && b.typeId === "minecraft:water") b.setType("minecraft:air");
        } catch (err) {}
      }
    }
  }, 100);
}

const ORE_SMELT = {
  "minecraft:iron_ore": "minecraft:iron_ingot",
  "minecraft:deepslate_iron_ore": "minecraft:iron_ingot",
  "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:deepslate_gold_ore": "minecraft:gold_ingot",
  "minecraft:copper_ore": "minecraft:copper_ingot",
  "minecraft:deepslate_copper_ore": "minecraft:copper_ingot",
  "minecraft:ancient_debris": "minecraft:netherite_scrap",
};
function smelterEffect(dimension, center) {
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          const drop = b && ORE_SMELT[b.typeId];
          if (drop) {
            b.setType("minecraft:air");
            dimension.spawnItem(new ItemStack(drop, 1), loc);
          }
        } catch (err) {}
      }
    }
  }
}

function harvestEffect(dimension, center) {
  const MATURE = {
    "minecraft:wheat": 7, "minecraft:carrots": 7, "minecraft:potatoes": 7,
    "minecraft:beetroot": 3, "minecraft:nether_wart": 3,
  };
  const R = 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        if (!b) continue;
        const maxAge = MATURE[b.typeId];
        if (maxAge === undefined) continue;
        const growth = b.permutation.getState("growth");
        if (growth !== undefined && growth < maxAge) {
          b.setPermutation(b.permutation.withState("growth", maxAge));
        }
      } catch (err) {}
    }
  }
}

function daynightEffect(dimension, center) {
  try {
    const t = world.getTimeOfDay();
    world.setTimeOfDay(t < 13000 ? 13000 : 0);
  } catch (err) {}
  try {
    dimension.playSound("random.orb", center);
  } catch (err) {}
}

function stormEffect(dimension, center) {
  try {
    world.setWeather("thunder", 6000);
  } catch (err) {}
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

function xpEffect(dimension, center) {
  for (let i = 0; i < 10; i++) {
    system.runTimeout(() => {
      try {
        dimension.spawnEntity("minecraft:xp_orb", {
          x: center.x + (Math.random() - 0.5) * 2,
          y: center.y + 0.5,
          z: center.z + (Math.random() - 0.5) * 2,
        });
      } catch (err) {}
    }, i * 2);
  }
}

function endermanEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      if (ent.typeId !== "minecraft:player") continue;
      const dx = (Math.random() - 0.5) * 16;
      const dz = (Math.random() - 0.5) * 16;
      ent.teleport({ x: ent.location.x + dx, y: ent.location.y, z: ent.location.z + dz });
    } catch (err) {}
  }
  for (let i = 0; i < 3; i++) {
    try {
      dimension.spawnEntity("minecraft:enderman", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
  }
}

function slimeEffect(dimension, center) {
  for (let i = 0; i < 3; i++) {
    try {
      dimension.spawnEntity("minecraft:slime", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
  for (const ent of nearbyEntities(dimension, center, 5)) {
    try {
      ent.applyImpulse({ x: 0, y: 0.8, z: 0 });
    } catch (err) {}
  }
}

const FRIENDLY_ANIMALS = ["minecraft:chicken", "minecraft:cow", "minecraft:pig", "minecraft:sheep"];
function animalEffect(dimension, center) {
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

function iceageEffect(dimension, center) {
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

const TREASURE_JACKPOT = ["minecraft:diamond", "minecraft:emerald", "minecraft:netherite_scrap"];
function fortuneEffect(dimension, center) {
  if (Math.random() < 0.5) {
    try {
      announce("§6★ 大当たり！お宝の雨だ！★§r");
    } catch (err) {}
    for (let i = 0; i < 10; i++) {
      try {
        const itemId = TREASURE_JACKPOT[Math.floor(Math.random() * TREASURE_JACKPOT.length)];
        const item = dimension.spawnItem(new ItemStack(itemId, 1 + Math.floor(Math.random() * 2)), {
          x: center.x + (Math.random() - 0.5) * 2,
          y: center.y + 1,
          z: center.z + (Math.random() - 0.5) * 2,
        });
        item.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.4, z: (Math.random() - 0.5) * 0.3 });
      } catch (err) {}
    }
  } else {
    try {
      announce("§8はずれ...呪われてしまった§r");
    } catch (err) {}
    for (const ent of nearbyEntities(dimension, center, 5)) {
      try {
        ent.addEffect("minecraft:weakness", 200, { amplifier: 1, showParticles: false });
        ent.addEffect("minecraft:unluck", 200, { amplifier: 0, showParticles: false });
      } catch (err) {}
    }
  }
}

function builderEffect(dimension, center) {
  const UPGRADE = {
    "minecraft:cobblestone": "minecraft:stone_bricks",
    "minecraft:dirt": "minecraft:dirt_path",
    "minecraft:oak_log": "minecraft:oak_planks",
    "minecraft:sand": "minecraft:sandstone",
  };
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) - 1, z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        const up = b && UPGRADE[b.typeId];
        if (up) b.setType(up);
      } catch (err) {}
    }
  }
}

function shaftEffect(dimension, center) {
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

function beamEffect(dimension, center) {
  const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  for (const d of dirs) {
    for (let dist = 1; dist <= 14; dist++) {
      const loc = { x: center.x + d.x * dist, y: center.y, z: center.z + d.z * dist };
      system.runTimeout(() => {
        try {
          dimension.spawnParticle("minecraft:endrod", loc);
        } catch (err) {}
        for (const ent of nearbyEntities(dimension, loc, 1.2)) {
          try {
            ent.applyDamage(4, { cause: "entityExplosion" });
          } catch (err) {}
        }
      }, dist);
    }
  }
}

function invisibilityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:invisibility", 200, { amplifier: 0, showParticles: false });
    } catch (err) {}
  }
}

function speedEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:speed", 300, { amplifier: 3, showParticles: false });
    } catch (err) {}
  }
}

function honeyEffect(dimension, center) {
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

function scorchedEffect(dimension, center) {
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

function feastEffect(dimension, center) {
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

function cactusEffect(dimension, center) {
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R || Math.random() > 0.35) continue;
      const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y), z: Math.floor(center.z) + dz };
      try {
        const b = dimension.getBlock(loc);
        const below = dimension.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
        if (b && b.typeId === "minecraft:air" && below &&
            (below.typeId === "minecraft:sand" || below.typeId === "minecraft:red_sand")) {
          trySetBlock(dimension, loc, ["minecraft:cactus"]);
        }
      } catch (err) {}
    }
  }
}

function obsidianEffect(dimension, center) {
  const R = 5;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const loc = { x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz };
        try {
          const b = dimension.getBlock(loc);
          if (b && (b.typeId === "minecraft:lava" || b.typeId === "minecraft:flowing_lava")) {
            b.setType("minecraft:obsidian");
          }
        } catch (err) {}
      }
    }
  }
}

function glowEffect(dimension, center) {
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

function vacuumEffect(dimension, center) {
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

function chorusEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      const dx = (Math.random() - 0.5) * 10;
      const dy = Math.random() * 4;
      const dz = (Math.random() - 0.5) * 10;
      ent.teleport({ x: center.x + dx, y: center.y + dy, z: center.z + dz });
      dimension.playSound("mob.endermen.portal", ent.location);
    } catch (err) {}
  }
  for (let i = 0; i < 3; i++) {
    try {
      dimension.spawnItem(new ItemStack("minecraft:chorus_fruit", 1), {
        x: center.x + (Math.random() - 0.5) * 2,
        y: center.y + 0.5,
        z: center.z + (Math.random() - 0.5) * 2,
      });
    } catch (err) {}
  }
}

/**
 * 究極TNT(終焉TNT): このアドオンの集大成。
 * 単体でも強力な爆発(核系と同じ「1tickに1発」方式で安全に処理)に加え、
 * ランダムに選んだ4〜5個の効果を時間差で連続発動させる、まさに何でもありの一撃。
 * どの効果が出るかは毎回変わるので、riddleのように結果を予測できないのが売り。
 */
function armageddonEffect(dimension, center) {
  try {
    announce("§0§l☠☠☠ 終焉TNTが世界の理を破壊した ☠☠☠§r");
  } catch (err) {}

  mushroomCloud(dimension, center, { stemHeight: 30, capRadius: 26, duration: 120 });
  fireEffect(dimension, center, 12);
  radiationZone(dimension, center, { radius: 18, duration: 600, amplifier: 2 });
  shockwaveKnockback(dimension, center, 40, 2.6);
  irradiateEntities(dimension, center, 34, 65);
  craterBurst(dimension, center, { radius: 60, count: 60, basePower: 18, coreCount: 6, corePower: 20, dome: 5, pointRadius: 4 });
  nukeImpact(dimension, center, 100, 0.95, 3.2);

  // ランダムな追加効果を数個、時間差で連続発動する
  const pool = [
    iceEffect, poisonEffect, thunderEffect, teleportEffect, antiGravityEffect,
    lavaEffect, waterEffect, darknessEffect, summonEffect, earthquakeEffect,
    bouncyEffect, webEffect, treasureEffect, swapEffect, confusionEffect,
    grassEffect, desertEffect, snowgolemEffect, beeEffect, arrowEffect,
    musicEffect, tsunamiEffect, harvestEffect, xpEffect, endermanEffect,
    slimeEffect, animalEffect, iceageEffect, fortuneEffect, beamEffect,
    invisibilityEffect, speedEffect, honeyEffect, scorchedEffect, feastEffect,
    cactusEffect, obsidianEffect, glowEffect, vacuumEffect, chorusEffect,
  ];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 4 + Math.floor(Math.random() * 2));
  picks.forEach((fn, i) => {
    system.runTimeout(() => {
      try {
        announce(`§5[終焉] ${i + 1}発目: §d${fn.name}§5 発動！§r`);
      } catch (err) {}
      try {
        fn(dimension, center);
      } catch (err) {}
    }, 30 + i * 25);
  });
}
