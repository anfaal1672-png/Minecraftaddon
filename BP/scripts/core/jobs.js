/**
 * 重い処理をまとめて捌くための、共有のジョブ置き場。
 *
 * 地形をくり抜くような処理は、まともに書くと数百万ブロックに触ることになる。
 * 1tickで全部やればゲームが固まり、TNTごとに勝手なタイマーを回せば
 * 同時に何発も爆発したときに負荷が足し算で膨れ上がる。
 *
 * そこで「重い処理はすべてジェネレータとしてここへ出す」形にした。
 *   ・実行はエンジン任せ (system.runJob)。端末の性能に応じて自動で分割される
 *   ・同時に走るジョブ数に上限を設ける。10発同時に爆発しても負荷は増えない
 *   ・待ちが溢れたら、優先度の低いものから捨てる
 *
 * 呼ぶ側は「どれくらいで終わるか」を気にせず、区切りのいいところで
 * yield するジェネレータを書くだけでよい。
 */
import { system } from "@minecraft/server";
import { note } from "./log.js";

/** 同時に走らせるジョブの数 */
export const MAX_CONCURRENT = 2;

/** 順番待ちの上限。これを超えたら優先度の低いものから捨てる */
export const MAX_QUEUED = 48;

/** system.runJob が無い端末で、1tickに進めるステップ数 */
const FALLBACK_STEPS_PER_TICK = 900;

const queued = [];
const running = new Set();
let dropped = 0;
let completed = 0;

/**
 * 重い処理を積む。
 *
 * @param {string} name 何の処理か (記録用)
 * @param {() => Generator} make ジェネレータを作る関数。始まるまで呼ばれない
 * @param {object} options
 *   priority 大きいほど先に走り、捨てられにくい (既定 0)
 *   onDone   終わったときに呼ばれる
 */
export function submit(name, make, { priority = 0, onDone } = {}) {
  const entry = { name, make, priority, onDone, seq: completed + queued.length };
  queued.push(entry);
  queued.sort((a, b) => b.priority - a.priority || a.seq - b.seq);

  while (queued.length > MAX_QUEUED) {
    const victim = queued.pop();
    dropped++;
    note("jobs:overflow", `${victim.name} を捨てた (順番待ちが ${MAX_QUEUED} 件を超えた)`);
  }
  pump();
  return entry;
}

function pump() {
  while (running.size < MAX_CONCURRENT && queued.length > 0) {
    start(queued.shift());
  }
}

function start(entry) {
  running.add(entry);
  const finish = () => {
    running.delete(entry);
    completed++;
    if (entry.onDone) {
      try {
        entry.onDone();
      } catch (err) {
        note(`jobs:onDone:${entry.name}`, err);
      }
    }
    // ジョブの中から次のジョブを積み直さないよう、1tick置いてから次へ
    try {
      system.run(pump);
    } catch (err) {
      pump();
    }
  };

  let gen;
  try {
    gen = entry.make();
  } catch (err) {
    note(`jobs:make:${entry.name}`, err);
    finish();
    return;
  }

  if (typeof system.runJob === "function") {
    try {
      entry.jobId = system.runJob(drive(gen, entry.name, finish));
      return;
    } catch (err) {
      note("jobs:runJob", err);
    }
  }
  runWithInterval(gen, entry, finish);
}

/** エンジンにジョブとして渡す形。終わったら必ず finish を呼ぶ */
function* drive(gen, name, finish) {
  try {
    yield* gen;
  } catch (err) {
    note(`jobs:run:${name}`, err);
  } finally {
    finish();
  }
}

/** system.runJob が使えない端末向けの代替。自前で少しずつ進める */
function runWithInterval(gen, entry, finish) {
  const id = system.runInterval(() => {
    for (let i = 0; i < FALLBACK_STEPS_PER_TICK; i++) {
      let step;
      try {
        step = gen.next();
      } catch (err) {
        note(`jobs:run:${entry.name}`, err);
        step = { done: true };
      }
      if (step.done) {
        system.clearRun(id);
        finish();
        return;
      }
    }
  }, 1);
  entry.intervalId = id;
}

/** 途中のジョブも順番待ちもすべて捨てる (テストと再読み込み用) */
export function cancelAll() {
  queued.length = 0;
  for (const entry of [...running]) {
    if (entry.jobId !== undefined && typeof system.clearJob === "function") {
      try {
        system.clearJob(entry.jobId);
      } catch (err) {
        note("jobs:clearJob", err);
      }
    }
    if (entry.intervalId !== undefined) {
      try {
        system.clearRun(entry.intervalId);
      } catch (err) {
        note("jobs:clearRun", err);
      }
    }
    running.delete(entry);
  }
}

export function jobStats() {
  return {
    running: running.size,
    queued: queued.length,
    completed,
    dropped,
    names: [...running].map((e) => e.name),
  };
}
