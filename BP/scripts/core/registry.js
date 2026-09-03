/**
 * TNTの一覧と、その引き方。
 *
 * 数値そのものは data/tnt-table.js にあり、そちらはリポジトリ直下の
 * data/ から `node tools/build.mjs` で自動生成される。
 * 効果の実体は effects/index.js が名前で引けるようにしてあるので、
 * 表の側は関数を持たず名前だけを持てばよい。
 */
import { TNT_TABLE } from "../data/tnt-table.js";
import { CATEGORIES } from "../data/categories.js";
import { EFFECTS } from "../effects/index.js";

export const NS = "manytnt";
/** 起爆中 (導火線が燃えている状態) のTNTのエンティティ */
export const PRIMED_TNT = `${NS}:primed_tnt`;
/** 起爆中エンティティに付ける「元の種類」のタグの接頭辞 */
export const TAG_PREFIX = "manytnt_type:";
/** 起爆中エンティティに渡す、見た目を選ぶプロパティ */
export const KIND_PROPERTY = `${NS}:kind`;
/** 図鑑を開くアイテム */
export const CATALOG_ITEM = `${NS}:catalog`;
/** 遠隔起爆装置 */
export const DETONATOR_ITEM = `${NS}:detonator`;

const byTypeId = new Map();

TNT_TABLE.forEach((def, index) => {
  const typeId = `${NS}:${def.id}`;
  byTypeId.set(typeId, {
    ...def,
    typeId,
    // 起爆中エンティティの見た目を選ぶ番号。表の並び順そのもの
    index,
    // 効果の実体。表に名前が無いものは演出だけのTNT
    run: def.effect ? EFFECTS[def.effect] ?? null : null,
    // よく使う判定を先に済ませておく
    isGacha: def.traits.includes("gacha"),
    launchUp: def.traits.includes("launchUp"),
    gravityPull: def.traits.includes("gravityPull"),
    magnetPull: def.traits.includes("magnetPull"),
  });
});

/** 全種類の識別子 (manytnt:xxx)。並びは見た目の番号と一致する */
export const TNT_TYPE_IDS = [...byTypeId.keys()];
export const TNT_COUNT = TNT_TYPE_IDS.length;
export const ALL_CONFIGS = [...byTypeId.values()];

export { CATEGORIES };

/** このアドオンのTNTなら設定を返す。そうでなければ undefined */
export function tntConfig(typeId) {
  return byTypeId.get(typeId);
}

/** このアドオンのTNTか */
export function isTnt(typeId) {
  return byTypeId.has(typeId);
}

/** 起爆中エンティティの見た目の番号 */
export function tntKindIndex(typeId) {
  return byTypeId.get(typeId)?.index ?? 0;
}

/** manytnt: を外した短い名前 */
export function shortName(typeId) {
  return typeId.startsWith(`${NS}:`) ? typeId.slice(NS.length + 1) : typeId;
}

/** 表示名 (日本語) */
export function displayName(typeId) {
  return byTypeId.get(typeId)?.name.ja ?? shortName(typeId);
}

/** そのカテゴリのTNTだけ */
export function configsInCategory(categoryId) {
  return ALL_CONFIGS.filter((c) => c.cat === categoryId);
}

/** ガチャで引いてよい種類 (ガチャ自身は除く) */
export function gachaCandidates() {
  return ALL_CONFIGS.filter((c) => !c.isGacha);
}
