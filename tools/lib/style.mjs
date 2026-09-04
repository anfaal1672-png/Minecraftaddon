/**
 * 全種類に共通するテクスチャの設定。
 *
 * 種類ごとの色と紋章の割り当ては data/tnt-defs.mjs に移した
 * (TNTの定義を1か所にまとめるため)。
 */

/** 虹TNTの縞に使う色 */
export const RAINBOW_ROWS = ["#e03a3a", "#e8892a", "#e8d02a", "#3ab84a", "#2a7ad8", "#8a4ad8"];

/**
 * 全TNT共通の底面テクスチャの色。
 * バニラのTNTの底面は側面と同じ赤を使っているので、それに合わせる。
 */
export const BOTTOM = { color: "#d4331c" };
