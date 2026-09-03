/**
 * 生成できるものをすべて作り直す。
 *   実行: node tools/build.mjs [--skip-textures] [--only=<id>]
 *
 * data/ に書いた1件の定義から、ブロック・レシピ・ドロップ・言語ファイル・
 * テクスチャ・起爆中エンティティ・スクリプトが読む表まで、すべてここで作る。
 * 手で直す必要のあるファイルは data/ と BP/scripts/effects/ だけ。
 */
import { checkDefs, TNT_DEFS } from "../data/index.mjs";
import { EMBLEMS } from "./lib/emblems.mjs";
import { resetStats, stats } from "./lib/io.mjs";
import { generateAssets } from "./gen/assets.mjs";
import { generateEntity } from "./gen/entity.mjs";
import { findEffectFunctions, generateScripts } from "./gen/scripts.mjs";
import { generateTextures } from "./gen/textures.mjs";

const args = process.argv.slice(2);
const skipTextures = args.includes("--skip-textures");
const only = args.find((a) => a.startsWith("--only="))?.slice(7) ?? null;

resetStats();

/* 1) まず定義そのものを検査する。おかしいまま生成しても意味が無い */
const errors = checkDefs({
  knownEmblems: Object.keys(EMBLEMS),
  knownEffects: [...findEffectFunctions().keys()],
});
if (errors.length) {
  console.error("❌ data/ の定義に問題がある:");
  for (const error of errors) console.error(`   ${error}`);
  process.exit(1);
}

/* 2) 生成 */
const removed = generateAssets();
generateEntity();
const scripts = generateScripts();

let textures = null;
if (!skipTextures) {
  try {
    textures = generateTextures({ only });
  } catch (err) {
    console.error(`❌ テクスチャを生成できなかった。\n\n${err.message}\n`);
    console.error("テクスチャを作り直さないのであれば --skip-textures を付ける。");
    process.exit(1);
  }
}

/* 3) 結果 */
const { written, unchanged } = stats();
console.log(`✅ TNT ${TNT_DEFS.length} 種類 / 効果 ${scripts.effects} 個`);
console.log(`   書き換え ${written} / 変化なし ${unchanged}`);
if (removed.length) console.log(`   削除 ${removed.length}: ${removed.join(", ")}`);
if (textures) console.log(`   テクスチャの土台: ${textures.source}`);
else console.log("   テクスチャは生成していない (--skip-textures)");
