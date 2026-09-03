/**
 * このアドオンが追加するTNTの一覧。**唯一の情報源**。
 *
 * ブロック定義・レシピ・ドロップ表・言語ファイル・テクスチャ・
 * 起爆中エンティティ・スクリプトの設定表は、すべてここから
 * `node tools/build.mjs` で生成される。TNTを増やすときは
 * data/tnt/<カテゴリ>.mjs に1件足すだけでよい。
 *
 * 1件ぶんの書式と、その決まりごとは data/schema.mjs にある。
 */
import { CATEGORIES } from "./categories.mjs";
import { DEFAULT_FUSE, validateAll } from "./schema.mjs";

import basic from "./tnt/basic.mjs";
import nuclear from "./tnt/nuclear.mjs";
import elemental from "./tnt/elemental.mjs";
import motion from "./tnt/motion.mjs";
import creature from "./tnt/creature.mjs";
import terrain from "./tnt/terrain.mjs";
import utility from "./tnt/utility.mjs";
import spectacle from "./tnt/spectacle.mjs";
import chaos from "./tnt/chaos.mjs";

const SOURCES = { basic, nuclear, elemental, motion, creature, terrain, utility, spectacle, chaos };

export const NAMESPACE = "manytnt";

/**
 * カテゴリの並び順どおりに全件をつなげたもの。
 * この配列の添字が、そのまま起爆中エンティティの見た目の番号になる。
 */
export const TNT_DEFS = CATEGORIES.flatMap((cat) => {
  const list = SOURCES[cat.file];
  if (!Array.isArray(list)) throw new Error(`data/tnt/${cat.file}.mjs が配列を返していない`);
  return list.map((def, i) => ({
    ...def,
    category: cat.id,
    fuse: def.fuse ?? DEFAULT_FUSE,
    traits: def.traits ?? {},
    effect: def.effect ?? null,
    orderInCategory: i,
  }));
});

export const TNT_IDS = TNT_DEFS.map((d) => d.id);
export const TNT_BY_ID = new Map(TNT_DEFS.map((d) => [d.id, d]));

/** manytnt:<id> の形にする */
export const typeIdOf = (id) => `${NAMESPACE}:${id}`;

/** そのカテゴリのTNTだけを返す */
export function defsInCategory(categoryId) {
  return TNT_DEFS.filter((d) => d.category === categoryId);
}

/** 使われている導火線の長さを、短い順に重複なしで返す */
export function fuseLengths() {
  return [...new Set(TNT_DEFS.map((d) => d.fuse))].sort((a, b) => a - b);
}

/**
 * 定義を検証する。問題の説明を配列で返し、空なら問題なし。
 * ビルドの入口で必ず呼ぶこと。
 */
export function checkDefs(options = {}) {
  const errors = validateAll(TNT_DEFS, options);
  const known = new Set(CATEGORIES.map((c) => c.file));
  for (const key of Object.keys(SOURCES)) {
    if (!known.has(key)) errors.push(`data/tnt/${key}.mjs は categories.mjs に登録されていない`);
  }
  return errors;
}
