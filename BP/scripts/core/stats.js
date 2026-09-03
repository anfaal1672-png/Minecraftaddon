/**
 * 爆発の記録と実績。ワールドに保存される。
 *
 * 保存は「変更があったら1秒後にまとめて1回」。連鎖爆発では1秒間に
 * 100発以上まとめて起きるので、そのたびに書き出すのは無駄が大きい。
 */
import { system, world } from "@minecraft/server";
import { attempt } from "./log.js";
import { announce } from "./chat.js";
import { shortName, TNT_COUNT } from "./registry.js";

const STORE_KEY = "manytnt:stats";

/** dynamic property に入れられる上限 (バイト) に対する自前の余裕 */
const MAX_JSON_BYTES = 24 * 1024;

let stats = { counts: {}, total: 0, milestones: [] };
let loaded = false;
let savePending = false;

export function loadStats() {
  if (loaded) return stats;
  loaded = true;
  const raw = attempt("stats:read", () => world.getDynamicProperty(STORE_KEY), undefined);
  if (typeof raw === "string") {
    const parsed = attempt("stats:parse", () => JSON.parse(raw), null);
    if (parsed && typeof parsed === "object") stats = parsed;
  }
  if (!stats.counts || typeof stats.counts !== "object") stats.counts = {};
  if (!Array.isArray(stats.milestones)) stats.milestones = [];
  if (typeof stats.total !== "number") stats.total = 0;
  return stats;
}

export function getStats() {
  return loadStats();
}

function saveSoon() {
  if (savePending) return;
  savePending = true;
  attempt("stats:schedule", () =>
    system.runTimeout(() => {
      savePending = false;
      flushStats();
    }, 20)
  );
}

export function flushStats() {
  const json = attempt("stats:stringify", () => JSON.stringify(stats), null);
  if (json === null) return;
  if (json.length > MAX_JSON_BYTES) {
    // ここまで来ることはまず無いが、保存できなくなるほうが困るので
    // 回数の少ないものから落として収める
    const entries = Object.entries(stats.counts).sort((a, b) => b[1] - a[1]).slice(0, 200);
    stats.counts = Object.fromEntries(entries);
  }
  attempt("stats:write", () => world.setDynamicProperty(STORE_KEY, JSON.stringify(stats)));
}

export function hasMilestone(name) {
  return loadStats().milestones.includes(name);
}

export function unlockMilestone(name, message) {
  if (hasMilestone(name)) return false;
  stats.milestones.push(name);
  announce(message, { force: true });
  return true;
}

/** 累計爆発数の節目 */
const TOTAL_MILESTONES = [10, 50, 200, 1000, 5000];

/** 初めて使ったときにお祝いする種類 */
const FIRST_USE_TITLES = {
  nuke_tnt: "§c☢ 実績解除: 初めての核実験§r",
  ultra_nuke_tnt: "§4☢ 実績解除: 更なる高みへ§r",
  hydrogen_bomb_tnt: "§5☢ 実績解除: 水爆保有国§r",
  tsar_bomba_tnt: "§d☢ 実績解除: 人類最大の爆発§r",
  antimatter_tnt: "§f⚛ 実績解除: 物質の終わり§r",
  armageddon_tnt: "§0§l☠ 実績解除: 終焉を見た者§r",
  singularity_tnt: "§8⬤ 実績解除: 事象の地平線の向こう§r",
};

/** 1発ぶんを記録する */
export function recordExplosion(typeId) {
  loadStats();
  const name = shortName(typeId);
  stats.counts[name] = (stats.counts[name] ?? 0) + 1;
  stats.total++;

  for (const milestone of TOTAL_MILESTONES) {
    if (stats.total === milestone) {
      unlockMilestone(`total_${milestone}`, `§6🏆 累計爆発数が${milestone}回に到達しました！§r`);
    }
  }

  if (FIRST_USE_TITLES[name]) unlockMilestone(`first_${name}`, FIRST_USE_TITLES[name]);

  const distinct = Object.keys(stats.counts).length;
  if (distinct >= TNT_COUNT) {
    unlockMilestone(
      "all_types",
      `§b§l🏆🏆🏆 実績解除: 全${TNT_COUNT}種類制覇！あなたは真のTNTマスターだ 🏆🏆🏆§r`
    );
  }

  saveSoon();
}

/** 使用回数の多い順 */
export function topUsed(limit = 5) {
  return Object.entries(loadStats().counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** 使った種類の数 */
export function distinctUsed() {
  return Object.keys(loadStats().counts).length;
}

/** 記録を消す */
export function resetStats() {
  stats = { counts: {}, total: 0, milestones: [] };
  loaded = true;
  flushStats();
}
