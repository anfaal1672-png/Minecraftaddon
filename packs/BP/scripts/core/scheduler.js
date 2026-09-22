import { system } from "@minecraft/server";
import { warn } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  予算付きタスク実行。                                                */
/*                                                                    */
/*  ・ブロック処理: ジェネレーター関数を登録すると、毎tick 合計            */
/*    BLOCK_BUDGET 回分の処理まで少しずつ進める。ジェネレーターは         */
/*    「今回こなした処理数」を yield する (省略時は1)。                   */
/*    同時に進めるのは MAX_ACTIVE 個まで。残りは順番待ち。               */
/*  ・爆発: createExplosion は 1tick に EXPLOSIONS_PER_TICK 発まで。      */
/*    TNT本体の爆発 (priority) を、クレーター用の追加爆発より先に処理する。*/
/*                                                                    */
/*  何百個も同時に爆発させても 1tick の負荷に上限があるため、             */
/*  ウォッチドッグによる強制終了 (ハング) が起きない。                    */
/* ------------------------------------------------------------------ */
export const BLOCK_BUDGET = 4096;
export const MAX_ACTIVE = 8;
export const EXPLOSIONS_PER_TICK = 1;
export const MAX_POWER = 100;

const jobs = [];
const explosionsHigh = [];
const explosionsLow = [];
let loopId = null;

/** 自前で起こした爆発の記録 (連鎖スキャンの二重実行を防ぐ。B02) */
const ownExplosions = [];

export function runBlockJob(label, generatorFn) {
  let it;
  try {
    it = generatorFn();
  } catch (err) {
    warn(`job ${label}`, err);
    return;
  }
  jobs.push({ label, it });
  ensureLoop();
}

/**
 * 爆発を予約する。
 * opts: createExplosion の ExplosionOptions
 * meta: { priority, own } own=true なら連鎖スキャン対象から外す
 */
export function queueExplosion(dimension, location, power, opts = {}, meta = {}) {
  const entry = { dimension, location, power: Math.max(0, Math.min(power, MAX_POWER)), opts, own: !!meta.own };
  (meta.priority ? explosionsHigh : explosionsLow).push(entry);
  ensureLoop();
}

export function pendingWork() {
  return { jobs: jobs.length, explosions: explosionsHigh.length + explosionsLow.length };
}

/** beforeEvents.explosion から呼ぶ: 自前の爆発ならその記録を消費して true */
export function consumeOwnExplosion(dimensionId, near) {
  const now = system.currentTick;
  for (let i = ownExplosions.length - 1; i >= 0; i--) {
    const e = ownExplosions[i];
    if (now - e.tick > 2) {
      ownExplosions.splice(i, 1);
      continue;
    }
    if (e.dimensionId !== dimensionId) continue;
    if (!near) continue;
    const dx = e.location.x - near.x;
    const dy = e.location.y - near.y;
    const dz = e.location.z - near.z;
    if (dx * dx + dy * dy + dz * dz <= (e.radius + 2) * (e.radius + 2)) {
      ownExplosions.splice(i, 1);
      return true;
    }
  }
  return false;
}

function ensureLoop() {
  if (loopId !== null) return;
  loopId = system.runInterval(tick, 1);
}

function tick() {
  // 古い「自前の爆発」の記録を捨てる (安全モードでは爆発イベントに
  // 壊れたブロックが無く照合されないまま残るため)
  while (ownExplosions.length && system.currentTick - ownExplosions[0].tick > 2) ownExplosions.shift();

  // --- 爆発 ---
  for (let n = 0; n < EXPLOSIONS_PER_TICK; n++) {
    const e = explosionsHigh.shift() ?? explosionsLow.shift();
    if (!e) break;
    if (e.power <= 0) continue;
    try {
      if (e.own) {
        ownExplosions.push({ dimensionId: e.dimension.id, location: e.location, radius: e.power, tick: system.currentTick });
      }
      e.dimension.createExplosion(e.location, e.power, e.opts);
    } catch (err) {
      warn("explosion", err);
    }
  }

  // --- ブロック処理 ---
  let budget = BLOCK_BUDGET;
  while (budget > 0 && jobs.length > 0) {
    const active = Math.min(MAX_ACTIVE, jobs.length);
    let progressed = false;
    for (let i = 0; i < active && budget > 0; i++) {
      const job = jobs[i];
      if (!job) break;
      let res;
      try {
        res = job.it.next();
      } catch (err) {
        warn(`job ${job.label}`, err);
        res = { done: true };
      }
      if (res.done) {
        jobs.splice(i, 1);
        i--;
        progressed = true;
        continue;
      }
      budget -= typeof res.value === "number" && res.value > 0 ? res.value : 1;
      progressed = true;
    }
    if (!progressed) break;
  }

  if (jobs.length === 0 && explosionsHigh.length === 0 && explosionsLow.length === 0 && ownExplosions.length === 0) {
    system.clearRun(loopId);
    loopId = null;
  }
}
