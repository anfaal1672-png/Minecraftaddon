import { world } from "@minecraft/server";
import { attempt, warn } from "../util/log.js";
import { clamp } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  ワールド設定。dynamic property "manytnt:settings" に JSON で保存する。 */
/*  設定メニュー (ui/settings.js) と /scriptevent manytnt:mute から変更。  */
/* ------------------------------------------------------------------ */
const KEY = "manytnt:settings";

export const DEFAULT_SETTINGS = Object.freeze({
  terrain: true, // 地形破壊 (false = 安全モード: 演出と効果のみ)
  powerScale: 1, // 威力倍率 0.25〜2
  allowNuclear: true, // 核系TNTの着火を許可
  chainPerSecond: 60, // 連鎖着火の上限 (1秒あたり)
  chat: true, // チャット演出
  gachaTable: "normal", // "normal" | "no_nuclear"
  nameTagLang: "ja", // 燃えているTNTの頭上に出す名前の言語
});

let cache = null;

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitize(s) {
  const out = { ...DEFAULT_SETTINGS, ...s };
  out.terrain = out.terrain !== false;
  out.powerScale = clamp(num(out.powerScale, 1), 0.25, 2);
  out.allowNuclear = out.allowNuclear !== false;
  out.chainPerSecond = clamp(Math.round(num(out.chainPerSecond, 60)), 10, 400);
  out.chat = out.chat !== false;
  out.gachaTable = out.gachaTable === "no_nuclear" ? "no_nuclear" : "normal";
  out.nameTagLang = out.nameTagLang === "en" ? "en" : "ja";
  return out;
}

function load() {
  let stored = {};
  attempt("settings.load", () => {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw === "string") stored = JSON.parse(raw);
    // v30 以前の「チャット演出OFF」設定を引き継ぐ
    else if (world.getDynamicProperty("manytnt:muted") === true) stored = { chat: false };
  });
  cache = sanitize(stored);
}

export function getSettings() {
  if (!cache) load();
  return cache;
}

export function updateSettings(patch) {
  cache = sanitize({ ...getSettings(), ...patch });
  try {
    world.setDynamicProperty(KEY, JSON.stringify(cache));
  } catch (err) {
    warn("settings.save", err);
  }
  return cache;
}

/** テスト用: キャッシュを捨てて次回読み直す */
export function resetSettingsCache() {
  cache = null;
}
