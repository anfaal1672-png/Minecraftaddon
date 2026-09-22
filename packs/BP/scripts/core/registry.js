import { TNT_DEFS } from "../generated/defs.js";
import { getSettings } from "../systems/settings.js";
import { weightedPick } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  TNT 定義の索引。定義そのものは tools/defs/tnt.json が正本で、       */
/*  generated/defs.js に生成される。効果関数との対応は effects/index.js。 */
/* ------------------------------------------------------------------ */
export const NS = "manytnt";
export const TNT_BY_ID = new Map(TNT_DEFS.map((d) => [d.id, d]));

export function getDef(typeId) {
  return TNT_BY_ID.get(typeId);
}

export function isTnt(typeId) {
  return TNT_BY_ID.has(typeId);
}

export function shortId(typeId) {
  return typeId.replace(`${NS}:`, "");
}

export const DEFAULT_GACHA_WEIGHT = 10;

/**
 * ガチャの抽選候補と重み (B27)。
 * 核系は定義の gachaWeight でごく低確率にし、設定で完全に除外もできる。
 * 核系の着火が禁止されているときも除外する。
 */
export function gachaCandidates(settings = getSettings()) {
  const excludeNuclear = settings.gachaTable === "no_nuclear" || !settings.allowNuclear;
  return TNT_DEFS.filter((d) => !d.isGacha && !(excludeNuclear && d.nuclear)).map((d) => ({
    value: d,
    weight: d.gachaWeight ?? DEFAULT_GACHA_WEIGHT,
  }));
}

export function rollGacha(random = Math.random, settings = getSettings()) {
  return weightedPick(gachaCandidates(settings), random);
}
