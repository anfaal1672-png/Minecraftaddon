/**
 * 爆発回数の記録と実績。ワールドに保存される。
 */
import { world, system } from "@minecraft/server";
import { announce } from "./announce.js";
import { TNT_COUNT, shortName } from "./registry.js";

/* ------------------------------------------------------------------ */
/*  実績・統計システム。                                                 */
/*  爆発のたびに種類別の回数をワールドに保存し、節目でお祝いメッセージを出す。 */
/*  /scriptevent manytnt:stats で進捗を確認できる。                      */
/* ------------------------------------------------------------------ */
export let stats = { counts: {}, total: 0, milestones: [] };

export let statsLoaded = false;

/**
 * 統計の保存。連鎖爆発では1秒間に100発以上まとめて起きることがあり、
 * そのたびに JSON へ書き出していると無駄が大きい。
 * 変更があったら1秒後にまとめて1回だけ書き込むようにする。
 */
export let statsSavePending = false;

export function loadStats() {
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

export function saveStats() {
  if (statsSavePending) return;
  statsSavePending = true;
  system.runTimeout(() => {
    statsSavePending = false;
    flushStats();
  }, 20);
}

export function flushStats() {
  try {
    world.setDynamicProperty("manytnt:stats", JSON.stringify(stats));
  } catch (err) {}
}

export function hasMilestone(name) {
  return stats.milestones.includes(name);
}

export function unlockMilestone(name, message) {
  if (hasMilestone(name)) return;
  stats.milestones.push(name);
  announce(message);
}

export function recordExplosion(typeId) {
  loadStats();
  const name = shortName(typeId);
  stats.counts[name] = (stats.counts[name] || 0) + 1;
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
  if (NUKE_FIRSTS[name] && !hasMilestone(`first_${name}`)) {
    unlockMilestone(`first_${name}`, NUKE_FIRSTS[name]);
  }

  // 全種類制覇
  const distinctUsed = Object.keys(stats.counts).length;
  const totalTypes = TNT_COUNT;
  if (distinctUsed >= totalTypes && !hasMilestone("all_types")) {
    unlockMilestone("all_types", `§b§l🏆🏆🏆 実績解除: 全${totalTypes}種類制覇！あなたは真のTNTマスターだ 🏆🏆🏆§r`);
  }

  saveStats();
}
