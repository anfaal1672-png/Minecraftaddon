import { system, world } from "@minecraft/server";
import { getDef, rollGacha } from "./registry.js";
import { getBlock } from "./safety.js";
import { nearbyEntities, isPlayer, pullToward, spawnEntitySafe } from "./entities.js";
import { detonateTntEntity } from "./explosion.js";
import { forgetMine } from "../systems/traps.js";
import { getSettings } from "../systems/settings.js";
import { announce, actionBar, msg, tntName, plainName } from "../systems/i18n.js";
import { attempt } from "../util/log.js";
import { centerOf, locKey, randInt } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  着火。                                                             */
/*                                                                    */
/*  ブロックを消して、タグ付きの本物の "minecraft:tnt" エンティティを     */
/*  召喚する。導火線・点滅・爆風で飛ぶ物理挙動はバニラのTNTそのもの。   */
/*                                                                    */
/*  【TNT増殖バグの修正 (B02)】                                          */
/*  以前は着火のたびにブロックの有無を確かめずにエンティティを出していたため、 */
/*  近くで複数の爆発が起きると1ブロックから何発も爆発していた。           */
/*  今は「ブロックがまだその種類であること」を確認してから、先にブロックを   */
/*  消費する。連鎖着火も位置ごとに1回しか予約しない。                     */
/* ------------------------------------------------------------------ */
export const TAG_TYPE = "manytnt_type:";
export const TAG_ORIGIN = "manytnt_origin:";
export const TAG_BY = "manytnt_by:";

const VANILLA_FUSE = 80;
const TRACK_TICKS = 120;

/** 核系が禁止されているときは着火しない (プレイヤー操作なら理由を表示) */
export function canIgnite(def, source) {
  if (def.nuclear && !getSettings().allowNuclear) {
    if (isPlayer(source)) actionBar(source, msg("nuclear_disabled", tntName(def.id)));
    return false;
  }
  return true;
}

/**
 * ブロックのTNTに着火する。着火できたら true。
 * opts.source  … 着火したプレイヤー (統計・橋TNTの向き・メッセージ用)
 * opts.fuse    … 導火線 (tick)。省略時はバニラと同じ 80tick、連鎖なら 10〜30tick
 * opts.chained … 他の爆発に巻き込まれた
 * opts.force   … 時限TNTのカウントダウンを飛ばしてすぐ着火する
 */
export function igniteBlock(dimension, loc, opts = {}) {
  const block = getBlock(dimension, loc);
  if (!block) return false;
  const def = getDef(block.typeId);
  if (!def) return false;
  if (!canIgnite(def, opts.source)) return false;

  const key = locKey(dimension.id, block.location);
  if (def.timer && !opts.chained && !opts.force) return startTimer(dimension, block.location, def, opts.source);
  timers.delete(key);

  // 先にブロックを消費する。消せなかったら着火しない (二重着火防止)
  const consumed = attempt("consume", () => {
    block.setType("minecraft:air");
    return true;
  });
  if (!consumed) return false;
  forgetMine(dimension.id, block.location);

  const fuse = opts.fuse ?? (opts.chained ? randInt(10, 30) : undefined);
  spawnLitTnt(dimension, centerOf(block.location), def, { ...opts, fuse });
  return true;
}

/**
 * 燃えているTNTエンティティを出す。
 * ガチャTNTはここで当たりを決め、エンティティのタグに「当たった種類」と
 * 「元の種類」の両方を書いておく (B06: 連鎖着火でも当たりの効果が出る)。
 */
export function spawnLitTnt(dimension, center, def, opts = {}) {
  let effective = def;
  if (def.isGacha) {
    effective = rollGacha() ?? def;
    attempt("gachaSound", () => dimension.playSound("random.orb", center)); // B05: center は宣言済み
    announce(msg("gacha_result", tntName(effective.id)));
  }

  attempt("fuseSound", () => dimension.playSound("random.fuse", center));
  const tnt = spawnEntitySafe(dimension, "minecraft:tnt", center);
  if (!tnt) return undefined;
  attempt("tags", () => {
    tnt.addTag(TAG_TYPE + effective.id);
    tnt.addTag(TAG_ORIGIN + def.id);
    if (isPlayer(opts.source)) tnt.addTag(TAG_BY + opts.source.id);
  });
  attempt("nameTag", () => {
    tnt.nameTag = plainName(effective);
  });
  if (effective.launchUp) attempt("launch", () => tnt.applyImpulse({ x: 0, y: 1.8, z: 0 }));
  if (opts.impulse) attempt("impulse", () => tnt.applyImpulse(opts.impulse));

  if (opts.fuse !== undefined && opts.fuse < VANILLA_FUSE) {
    // バニラTNTの導火線 (80tick) はスクリプトから変えられないので、
    // 先回りして爆発させることで短い導火線を再現する。
    system.runTimeout(() => detonateTntEntity(tnt), Math.max(1, opts.fuse));
  }
  track(dimension, tnt, effective);
  return tnt;
}

/** 飛んでいる間の軌跡パーティクルと、吸引・誘導の処理 */
function track(dimension, tnt, def) {
  const trail = def.trail ?? "minecraft:crit_particle";
  let ticks = 0;
  let target;
  const id = system.runInterval(() => {
    ticks += 4;
    let loc;
    try {
      loc = tnt.location;
    } catch (err) {
      system.clearRun(id); // 爆発して消えた
      return;
    }
    if (ticks > TRACK_TICKS) {
      system.clearRun(id);
      return;
    }
    attempt("trail", () =>
      dimension.spawnParticle(trail, {
        x: loc.x + (Math.random() - 0.5) * 0.6,
        y: loc.y + 0.6,
        z: loc.z + (Math.random() - 0.5) * 0.6,
      })
    );
    if (def.gravityPull) for (const e of nearbyEntities(dimension, loc, 8, "all")) pullToward(e, loc, 0.12, 0.6);
    if (def.magnetPull) for (const e of nearbyEntities(dimension, loc, 10, "items")) pullToward(e, loc, 0.25, 0.5);
    if (def.homing) target = homeIn(dimension, tnt, loc, target);
  }, 4);
}

/** 誘導TNT: 一番近い敵対モブへ向かって飛ぶ */
function homeIn(dimension, tnt, loc, current) {
  let target = current;
  const valid = attempt("targetValid", () => target && target.isValid);
  if (!valid) {
    const mobs = nearbyEntities(dimension, loc, 24, "living", { families: ["monster"], closest: 1 });
    target = mobs[0];
  }
  if (!target) return undefined;
  attempt("homing", () => {
    const t = target.location;
    const dx = t.x - loc.x;
    const dz = t.z - loc.z;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
    tnt.applyImpulse({ x: (dx / dist) * 0.3, y: t.y > loc.y ? 0.25 : 0.12, z: (dz / dist) * 0.3 });
  });
  return target;
}

/* ------------------------------------------------------------------ */
/*  連鎖着火のキュー (B02, B17)                                          */
/*  位置ごとに1回だけ予約し、1秒あたりの上限を超えた分は捨てずに待たせる。 */
/* ------------------------------------------------------------------ */
const MAX_QUEUE = 5000;
const scheduled = new Set();
const chainQueue = [];
let chainLoop = null;
let carry = 0;

export function scheduleChainIgnition(dimension, loc, delay) {
  const key = locKey(dimension.id, loc);
  if (scheduled.has(key) || chainQueue.length >= MAX_QUEUE) return false;
  scheduled.add(key);
  chainQueue.push({ dimension, loc: { ...loc }, key, due: system.currentTick + delay });
  if (chainLoop === null) chainLoop = system.runInterval(processChain, 1);
  return true;
}

export function chainQueueSize() {
  return chainQueue.length;
}

function processChain() {
  const perTick = getSettings().chainPerSecond / 20;
  carry = Math.min(carry + perTick, perTick + 1);
  const now = system.currentTick;
  for (let i = 0; i < chainQueue.length && carry >= 1; ) {
    const e = chainQueue[i];
    if (e.due > now) {
      i++;
      continue;
    }
    chainQueue.splice(i, 1);
    scheduled.delete(e.key);
    carry -= 1;
    igniteBlock(e.dimension, e.loc, { chained: true });
  }
  if (chainQueue.length === 0) {
    system.clearRun(chainLoop);
    chainLoop = null;
    carry = 0;
  }
}

/* ------------------------------------------------------------------ */
/*  時限TNT: ブロックのまま秒読みし、0秒で爆発する。                     */
/*  秒読み中にブロックを壊すと解除できる。                                */
/* ------------------------------------------------------------------ */
const timers = new Map();
let timerLoop = null;

function startTimer(dimension, loc, def, source) {
  const key = locKey(dimension.id, loc);
  if (timers.has(key)) return false;
  timers.set(key, { dimension, loc: { ...loc }, def, remaining: def.timer, sourceId: source?.id });
  attempt("armSound", () => dimension.playSound("random.click", centerOf(loc)));
  if (isPlayer(source)) actionBar(source, msg("timer_armed", tntName(def.id), String(def.timer)));
  if (timerLoop === null) timerLoop = system.runInterval(processTimers, 20);
  return true;
}

export function activeTimers() {
  return timers.size;
}

function processTimers() {
  for (const [key, t] of timers) {
    const block = getBlock(t.dimension, t.loc);
    if (!block) continue; // 未ロード中は一時停止
    const center = centerOf(t.loc);
    const players = nearbyEntities(t.dimension, center, 16, "all", { type: "minecraft:player" });
    if (block.typeId !== t.def.id) {
      timers.delete(key);
      for (const p of players) actionBar(p, msg("timer_defused", tntName(t.def.id)));
      continue;
    }
    t.remaining -= 1;
    for (const p of players) actionBar(p, msg("timer_countdown", tntName(t.def.id), String(Math.max(0, t.remaining))));
    attempt("tickSound", () => t.dimension.playSound("random.click", center, { pitch: t.remaining <= 5 ? 1.8 : 1 }));
    attempt("tickParticle", () => t.dimension.spawnParticle("minecraft:basic_flame_particle", { x: center.x, y: center.y + 1.1, z: center.z }));
    if (t.remaining <= 0) {
      timers.delete(key);
      const source = t.sourceId ? attempt("source", () => world.getEntity(t.sourceId)) : undefined;
      igniteBlock(t.dimension, t.loc, { force: true, fuse: 1, source });
    }
  }
  if (timers.size === 0) {
    system.clearRun(timerLoop);
    timerLoop = null;
  }
}
