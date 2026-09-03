/**
 * 中身がちぐはぐになっていないか調べる。
 *   実行: node tools/check.mjs
 *
 * 見るもの:
 *   1. data/ の定義そのもの
 *   2. コミットされている生成物が data/ と食い違っていないか
 *   3. 参照しているファイルが実在するか (テクスチャ・言語・ドロップ表)
 *   4. JSON が壊れていないか
 *   5. 使っている Minecraft の API が実在するか
 *   6. 効果音とパーティクルの名前が実在するか
 */
import fs from "node:fs";
import { TNT_DEFS, checkDefs, fuseLengths } from "../data/index.mjs";
import { CATEGORIES } from "../data/categories.mjs";
import { EMBLEMS } from "./lib/emblems.mjs";
import { at, exists, readJson, readText, resetStats, setDryRun, staleFiles } from "./lib/io.mjs";
import { generateAssets, TOOLS } from "./gen/assets.mjs";
import { generateEntity } from "./gen/entity.mjs";
import { findEffectFunctions, generateScripts } from "./gen/scripts.mjs";
import { checkApiUsage } from "./check-api.mjs";
import { checkAssetNames } from "./check-assets.mjs";

const problems = [];
const notes = [];
const fail = (message) => problems.push(message);

/* ------------------------------------------------------------------ */
/*  1. 定義そのもの                                                    */
/* ------------------------------------------------------------------ */
for (const error of checkDefs({
  knownEmblems: Object.keys(EMBLEMS),
  knownEffects: [...findEffectFunctions().keys()],
})) {
  fail(`定義: ${error}`);
}

/* ------------------------------------------------------------------ */
/*  2. 生成物が古くないか                                              */
/* ------------------------------------------------------------------ */
resetStats();
setDryRun(true);
try {
  generateAssets();
  generateEntity();
  generateScripts();
} catch (err) {
  fail(`生成: ${err.message}`);
}
setDryRun(false);
for (const file of staleFiles()) {
  fail(`生成物が古い: ${file} (node tools/build.mjs を実行する)`);
}

/* ------------------------------------------------------------------ */
/*  3. 参照しているファイルが実在するか                                */
/* ------------------------------------------------------------------ */
const terrain = readJson("RP/textures/terrain_texture.json").texture_data;
for (const [name, entry] of Object.entries(terrain)) {
  if (!exists(`RP/${entry.textures}.png`)) fail(`テクスチャが無い: ${name} → RP/${entry.textures}.png`);
}
const itemTextures = readJson("RP/textures/item_texture.json").texture_data;
for (const [name, entry] of Object.entries(itemTextures)) {
  if (!exists(`RP/${entry.textures}.png`)) fail(`アイテムのテクスチャが無い: ${name} → RP/${entry.textures}.png`);
}

for (const def of TNT_DEFS) {
  for (const rel of [
    `BP/blocks/${def.id}.json`,
    `BP/recipes/${def.id}.json`,
    `BP/loot_tables/blocks/${def.id}.json`,
    `RP/textures/blocks/${def.id}_side.png`,
    `RP/textures/blocks/${def.id}_top.png`,
    `RP/textures/entity/tnt/${def.id}.png`,
  ]) {
    if (!exists(rel)) fail(`足りないファイル: ${rel}`);
  }
}

// 起爆中エンティティのテクスチャの並びが、スクリプトの表と一致すること
const clientEntity = readJson("RP/entity/primed_tnt.entity.json")["minecraft:client_entity"];
const skins = readJson("RP/render_controllers/primed_tnt.render_controllers.json")
  .render_controllers["controller.render.manytnt_primed_tnt"].arrays.textures["array.skins"];
TNT_DEFS.forEach((def, i) => {
  if (skins[i] !== `Texture.${def.id}`) fail(`見た目の並びがずれている: ${i} 番目が ${skins[i]}`);
  if (!clientEntity.description.textures[def.id]) fail(`見た目の割り当てが無い: ${def.id}`);
});

// 導火線の長さ
const entity = readJson("BP/entities/primed_tnt.json")["minecraft:entity"];
for (const ticks of fuseLengths()) {
  if (!entity.component_groups[`manytnt:fuse_${ticks}`]) fail(`導火線 ${ticks} tick の設定が無い`);
}

/* 言語ファイル */
for (const locale of ["ja_JP", "en_US"]) {
  const bp = readText(`BP/texts/${locale}.lang`);
  const rp = readText(`RP/texts/${locale}.lang`);
  if (bp !== rp) fail(`BP と RP の ${locale}.lang が食い違っている`);
  for (const def of TNT_DEFS) {
    if (!bp.includes(`tile.manytnt:${def.id}.name=`)) fail(`${locale}: ${def.id} の表示名が無い`);
  }
  for (const tool of TOOLS) {
    if (!bp.includes(`item.manytnt:${tool.id}=`)) fail(`${locale}: ${tool.id} の表示名が無い`);
  }
  for (const category of CATEGORIES) {
    if (!bp.includes(`itemGroup.name.manytnt:${category.id}_group=`)) {
      fail(`${locale}: ${category.id} のグループ名が無い`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  4. JSON が壊れていないか                                           */
/* ------------------------------------------------------------------ */
function walkJson(rel) {
  const dir = at(rel);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const child = `${rel}/${name}`;
    if (fs.statSync(at(child)).isDirectory()) walkJson(child);
    else if (name.endsWith(".json")) {
      try {
        JSON.parse(readText(child));
      } catch (err) {
        fail(`JSON が壊れている: ${child} (${err.message})`);
      }
    }
  }
}
walkJson("BP");
walkJson("RP");

/* マニフェストの版が BP と RP で揃っていること */
const bpManifest = readJson("BP/manifest.json");
const rpManifest = readJson("RP/manifest.json");
if (JSON.stringify(bpManifest.header.version) !== JSON.stringify(rpManifest.header.version)) {
  fail(`BP と RP のバージョンが違う: ${bpManifest.header.version} / ${rpManifest.header.version}`);
}
for (const module of [...bpManifest.modules, ...rpManifest.modules]) {
  if (JSON.stringify(module.version) !== JSON.stringify(bpManifest.header.version)) {
    fail(`モジュールの版がヘッダと違う: ${module.uuid}`);
  }
}

/* ------------------------------------------------------------------ */
/*  5. API の存在                                                      */
/* ------------------------------------------------------------------ */
const api = checkApiUsage();
if (api.skipped) notes.push(api.reason);
else {
  for (const problem of api.problems) fail(`API: ${problem}`);
  notes.push(`APIの一覧: ${api.dir}`);
}

/* ------------------------------------------------------------------ */
/*  6. 効果音とパーティクル                                            */
/* ------------------------------------------------------------------ */
const assets = checkAssetNames();
if (assets.skipped) notes.push(assets.reason);
else {
  for (const problem of assets.problems) fail(problem);
  notes.push(`効果音 ${assets.sounds} 件 / パーティクル ${assets.particles} 件と突き合わせた`);
}

/* ------------------------------------------------------------------ */
console.log(`TNT ${TNT_DEFS.length} 種類 / カテゴリ ${CATEGORIES.length} / 紋章 ${Object.keys(EMBLEMS).length} を検査`);
for (const note of notes) console.log(`   ${note}`);

if (problems.length === 0) {
  console.log("✅ 問題なし");
  process.exit(0);
}
console.log(`\n❌ ${problems.length} 件の問題:`);
for (const problem of problems) console.log(`   ${problem}`);
process.exit(1);
