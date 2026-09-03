/**
 * ワールドごとの設定。
 *
 * 値はワールドに保存される (dynamic property) ので、
 * 一度決めれば次に開いたときもそのまま。ゲーム内からは
 * 設定画面 (/scriptevent manytnt:menu) か、コマンドで変えられる。
 *
 * 併せて、Minecraft 本体のゲームルールも見る。
 * tntExplodes や mobGriefing を切っている場所で、このアドオンだけ
 * 地形を壊してしまうのはさすがにおかしいため。
 */
import { world } from "@minecraft/server";
import { attempt } from "./log.js";

/**
 * 設定できる項目。
 *   key      保存に使う名前
 *   type     boolean / number
 *   default  初期値
 *   min/max  number のときの範囲
 */
export const SETTINGS = {
  announce: {
    key: "manytnt:announce",
    type: "boolean",
    default: true,
    name: { ja: "チャット演出", en: "Chat messages" },
    help: { ja: "爆発したときの案内文をチャットに出す", en: "Announce big explosions in chat" },
  },
  chain: {
    key: "manytnt:chain",
    type: "boolean",
    default: true,
    name: { ja: "連鎖爆発", en: "Chain reaction" },
    help: { ja: "近くのTNTを巻き込んで着火する", en: "Nearby TNT is set off by other blasts" },
  },
  terrain: {
    key: "manytnt:terrain",
    type: "boolean",
    default: true,
    name: { ja: "地形の破壊", en: "Terrain damage" },
    help: { ja: "切るとブロックを一切壊さなくなる", en: "Turn off to leave all blocks intact" },
  },
  scale: {
    key: "manytnt:scale",
    type: "number",
    default: 1,
    min: 0.25,
    max: 2,
    name: { ja: "規模の倍率", en: "Blast scale" },
    help: { ja: "核系の破壊半径をまとめて増減する", en: "Scales the nuclear blast radii" },
  },
  warning: {
    key: "manytnt:warning",
    type: "boolean",
    default: true,
    name: { ja: "着火の警報", en: "Fuse warning" },
    help: { ja: "大型TNTの導火線中に警報を鳴らす", en: "Sound an alarm while a big bomb burns" },
  },
};

const cache = new Map();
let loaded = false;

/** ワールドから設定を読み込む。ワールド読み込み後に1回呼べばよい */
export function load() {
  cache.clear();
  for (const [name, spec] of Object.entries(SETTINGS)) {
    const raw = attempt("settings:read", () => world.getDynamicProperty(spec.key), undefined);
    cache.set(name, coerce(spec, raw));
  }
  loaded = true;
}

function coerce(spec, raw) {
  if (spec.type === "boolean") return typeof raw === "boolean" ? raw : spec.default;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, raw));
}

/** 設定の値。読み込み前でも既定値を返すので、いつ呼んでも安全 */
export function get(name) {
  const spec = SETTINGS[name];
  if (!spec) return undefined;
  if (!loaded) return spec.default;
  return cache.has(name) ? cache.get(name) : spec.default;
}

/** 設定を変えて保存する。範囲外の値は丸められる */
export function set(name, value) {
  const spec = SETTINGS[name];
  if (!spec) return undefined;
  const next = coerce(spec, value);
  cache.set(name, next);
  loaded = true;
  attempt("settings:write", () => world.setDynamicProperty(spec.key, next));
  return next;
}

/** true/false の設定を反転する */
export function toggle(name) {
  return set(name, !get(name));
}

/** 全部を初期値に戻す */
export function reset() {
  for (const name of Object.keys(SETTINGS)) set(name, SETTINGS[name].default);
}

/** ゲームルールの値。取れなければ既定値 */
function gameRule(name, fallback = true) {
  return attempt("settings:gamerule", () => {
    const value = world.gameRules?.[name];
    return typeof value === "boolean" ? value : fallback;
  }, fallback);
}

/**
 * ブロックを壊してよいか。
 * このアドオンの設定と、ワールドのゲームルールの両方を見る。
 */
export function mayBreakBlocks() {
  if (!get("terrain")) return false;
  if (!gameRule("tntExplodes", true)) return false;
  if (!gameRule("mobGriefing", true)) return false;
  return true;
}

/** 火をつけてよいか */
export function maySetFire() {
  return mayBreakBlocks() && gameRule("doFireTick", true);
}

/** 破壊半径にかける倍率 */
export function blastScale() {
  return get("scale");
}

/** 倍率をかけた半径 (最低1は残す) */
export function scaledRadius(radius) {
  return Math.max(1, Math.round(radius * blastScale()));
}
