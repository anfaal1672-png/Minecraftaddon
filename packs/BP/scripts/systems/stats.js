import { system, world } from "@minecraft/server";
import { TNT_DEFS, CATEGORIES } from "../generated/defs.js";
import { getDef, shortId } from "../core/registry.js";
import { announce, msg, tntName } from "./i18n.js";
import { attempt, warn } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  実績・統計。                                                        */
/*  ・ワールド全体: 種類別の爆発回数と節目の実績 (v30 と同じ保存形式)     */
/*  ・プレイヤー別: 着火した人ごとの回数 (TNT図鑑に表示)                  */
/*  保存は 100tick ごとにまとめて行う (B21)。                             */
/* ------------------------------------------------------------------ */
const WORLD_KEY = "manytnt:stats";
const PLAYER_KEY = "manytnt:pstats";
const FLUSH_INTERVAL = 100;

let stats = null;
let worldDirty = false;
const players = new Map(); // playerId -> { data, dirty }
const recent = []; // 直近の爆発 { tick, type }

function emptyStats() {
  return { counts: {}, used: {}, total: 0, milestones: [] };
}

function normalize(s) {
  const out = { ...emptyStats(), ...(s ?? {}) };
  if (typeof out.counts !== "object" || out.counts === null) out.counts = {};
  if (typeof out.used !== "object" || out.used === null) out.used = {};
  if (!Array.isArray(out.milestones)) out.milestones = [];
  if (typeof out.total !== "number") out.total = 0;
  return out;
}

export function getWorldStats() {
  if (!stats) {
    stats = normalize(
      attempt("stats.load", () => {
        const raw = world.getDynamicProperty(WORLD_KEY);
        return typeof raw === "string" ? JSON.parse(raw) : undefined;
      })
    );
  }
  return stats;
}

function playerEntry(player) {
  let e = players.get(player.id);
  if (!e) {
    const data = normalize(
      attempt("pstats.load", () => {
        const raw = player.getDynamicProperty(PLAYER_KEY);
        return typeof raw === "string" ? JSON.parse(raw) : undefined;
      })
    );
    e = { data, dirty: false };
    players.set(player.id, e);
  }
  return e;
}

export function getPlayerStats(player) {
  return playerEntry(player).data;
}

/** 使ったことのある種類 (爆発した種類 + 着火した元の種類) */
export function usedTypes(s) {
  return new Set([...Object.keys(s.counts), ...Object.keys(s.used)]);
}

function unlock(s, name, message) {
  if (s.milestones.includes(name)) return false;
  s.milestones.push(name);
  if (message) announce(message);
  return true;
}

const NUCLEAR_FIRSTS = {
  nuke_tnt: "first_nuke",
  ultra_nuke_tnt: "first_ultra_nuke",
  hydrogen_bomb_tnt: "first_hydrogen",
  tsar_bomba_tnt: "first_tsar",
  antimatter_tnt: "first_antimatter",
  armageddon_tnt: "first_armageddon",
};
const TOTAL_MILESTONES = [10, 50, 200, 1000, 5000];

/**
 * 爆発を記録する。
 * typeId   … 実際に爆発した種類
 * originId … 着火したブロックの種類 (ガチャなど、typeId と違う場合も「使用済み」にする。B07)
 */
export function recordExplosion(typeId, originId, igniterId) {
  const s = getWorldStats();
  const short = shortId(typeId);
  s.counts[short] = (s.counts[short] || 0) + 1;
  if (originId && originId !== typeId) s.used[shortId(originId)] = true;
  s.total++;
  worldDirty = true;

  for (const m of TOTAL_MILESTONES) {
    if (s.total === m) unlock(s, `total_${m}`, msg("ach_total", String(m)));
  }
  const first = NUCLEAR_FIRSTS[short];
  if (first) unlock(s, `first_${short}`, msg(`ach_${first}`));
  if (usedTypes(s).size >= TNT_DEFS.length) unlock(s, "all_types", msg("ach_all_types", String(TNT_DEFS.length)));

  // 直近10秒の爆発 → 大連鎖・いろいろ実績
  const now = system.currentTick;
  recent.push({ tick: now, type: short });
  while (recent.length && now - recent[0].tick > 200) recent.shift();
  if (recent.length >= 50) unlock(s, "chain_50", msg("ach_chain_50"));
  if (new Set(recent.map((r) => r.type)).size >= 10) unlock(s, "variety_10", msg("ach_variety_10"));

  if (igniterId) {
    const player = attempt("igniter", () => world.getEntity(igniterId));
    if (player && player.typeId === "minecraft:player") recordForPlayer(player, typeId, originId);
  }
  ensureFlush();
}

function recordForPlayer(player, typeId, originId) {
  const e = playerEntry(player);
  const s = e.data;
  const short = shortId(typeId);
  s.counts[short] = (s.counts[short] || 0) + 1;
  if (originId && originId !== typeId) s.used[shortId(originId)] = true;
  s.total++;
  e.dirty = true;
  // 全カテゴリ制覇 (個人)
  const used = usedTypes(s);
  const cats = new Set();
  for (const t of used) {
    const def = getDef(`manytnt:${t}`);
    if (def) cats.add(def.category);
  }
  if (cats.size >= CATEGORIES.length && !s.milestones.includes("all_categories")) {
    s.milestones.push("all_categories");
    announce(msg("ach_all_categories", player.name));
  }
}

let flushId = null;
function ensureFlush() {
  if (flushId !== null) return;
  flushId = system.runTimeout(() => {
    flushId = null;
    flushStats();
  }, FLUSH_INTERVAL);
}

export function flushStats() {
  if (worldDirty && stats) {
    try {
      world.setDynamicProperty(WORLD_KEY, JSON.stringify(stats));
      worldDirty = false;
    } catch (err) {
      warn("stats.save", err);
    }
  }
  for (const [id, e] of players) {
    if (!e.dirty) continue;
    const player = attempt("pstats.player", () => world.getEntity(id));
    if (!player) {
      players.delete(id); // ログアウト済み: 次回ログイン時に読み直す
      continue;
    }
    attempt("pstats.save", () => {
      player.setDynamicProperty(PLAYER_KEY, JSON.stringify(e.data));
      e.dirty = false;
    });
  }
}

/** /scriptevent manytnt:stats の表示 */
export function statsMessages(player) {
  const s = getWorldStats();
  const lines = [
    msg("stats_total", String(s.total)),
    msg("stats_types", String(usedTypes(s).size), String(TNT_DEFS.length)),
  ];
  const top = Object.entries(s.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (top.length) {
    const rawtext = [msg("stats_top")];
    top.forEach(([k, v], i) => {
      rawtext.push({ text: i === 0 ? " " : ", " });
      rawtext.push(tntName(`manytnt:${k}`));
      rawtext.push({ text: `×${v}` });
    });
    lines.push({ rawtext });
  }
  if (player) {
    const p = getPlayerStats(player);
    lines.push(msg("stats_player", player.name, String(p.total), String(usedTypes(p).size), String(TNT_DEFS.length)));
  }
  return lines;
}

