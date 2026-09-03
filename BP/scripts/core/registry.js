/**
 * TNTの種類の一覧と、その設定の引き方。
 *
 * 数値そのものは data/tnt-table.js にあり、そちらはリポジトリ直下の
 * data/tnt-defs.mjs から `node tools/build-assets.mjs` で自動生成される。
 * 効果の実体は effects/index.js が名前で引けるようにしてあるので、
 * 表の側は関数を直接持たずに名前だけを持てばよい。
 */
import { TNT_TABLE } from "../data/tnt-table.js";
import { EFFECTS } from "../effects/index.js";

export const NS = "manytnt";
/** 起爆中(導火線が燃えている状態)のTNTのエンティティ */
export const PRIMED_TNT = `${NS}:primed_tnt`;
/** 起爆中エンティティに付ける「元の種類」のタグの接頭辞 */
export const TAG_PREFIX = "manytnt_type:";

const byTypeId = new Map();
TNT_TABLE.forEach((def, index) => {
  const typeId = `${NS}:${def.id}`;
  byTypeId.set(typeId, {
    ...def,
    typeId,
    // 起爆中エンティティの見た目を選ぶ番号。表の並び順そのもの
    index,
    // 効果の実体。名前が表に無い場合は演出だけのTNT
    run: def.effect ? EFFECTS[def.effect] ?? null : null,
  });
});

/** 全種類の識別子 (manytnt:xxx)。並びは見た目の番号と一致する */
export const TNT_TYPE_IDS = [...byTypeId.keys()];
export const TNT_COUNT = TNT_TYPE_IDS.length;

/** このアドオンのTNTなら設定を返す。そうでなければ undefined */
export function tntConfig(typeId) {
  return byTypeId.get(typeId);
}

/** 起爆中エンティティの見た目の番号 */
export function tntKindIndex(typeId) {
  return byTypeId.get(typeId)?.index ?? 0;
}

/** manytnt: を外した短い名前 */
export function shortName(typeId) {
  return typeId.startsWith(`${NS}:`) ? typeId.slice(NS.length + 1) : typeId;
}
