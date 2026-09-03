/**
 * TNTの種類を、定義された並び順で返す。
 *
 * 起爆中のエンティティは「何番目の種類か」(エンティティプロパティ
 * manytnt:kind) で見た目を選ぶ。その番号は data/tnt-defs.mjs の並び順
 * そのものなので、テクスチャ一覧やレンダーコントローラを作るときも
 * 必ずここを通して同じ順を使う。
 */
export { TNT_DEFS, TNT_IDS, TNT_BY_ID } from "../../data/tnt-defs.mjs";

/** 互換のための別名 */
export function tntTypesInOrder() {
  return TNT_IDS_LOCAL;
}

import { TNT_IDS as TNT_IDS_LOCAL } from "../../data/tnt-defs.mjs";
