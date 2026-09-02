/**
 * パックの整合性チェック。
 *   実行: node tools/validate.mjs
 *
 * main.js の TNT 一覧を正として、ブロック定義・レシピ・ドロップ表・
 * 言語ファイル・テクスチャ定義・テクスチャ実ファイルが全て揃っているか確認する。
 * TNT を追加したときの付け忘れをここで検出できる。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const list = (p) => fs.readdirSync(path.join(root, p));
const exists = (p) => fs.existsSync(path.join(root, p));

const problems = [];
const fail = (msg) => problems.push(msg);

/* --- 全JSONが壊れていないか --- */
function walkJson(dir) {
  for (const name of list(dir)) {
    const rel = path.posix.join(dir, name);
    if (fs.statSync(path.join(root, rel)).isDirectory()) walkJson(rel);
    else if (name.endsWith(".json")) {
      try {
        readJson(rel);
      } catch (err) {
        fail(`JSONが壊れている: ${rel} (${err.message})`);
      }
    }
  }
}
walkJson("BP");
walkJson("RP");

/* --- main.js の TNT 一覧 --- */
const main = read("BP/scripts/main.js");
const table = main.match(/const TNT_TABLE = \{([\s\S]*?)\n\};/)[1];
const types = [...table.matchAll(/\[`\$\{NS\}:(\w+)`\]/g)].map((m) => m[1]);
if (types.length === 0) fail("TNT_TABLE を読み取れなかった");

/* --- 各TNTに必要なファイルが揃っているか --- */
const has = (dir) => new Set(list(dir).map((f) => f.replace(/\.json$/, "")));
const blocks = has("BP/blocks");
const recipes = has("BP/recipes");
const loots = has("BP/loot_tables/blocks");

for (const t of types) {
  if (!blocks.has(t)) fail(`ブロック定義が無い: BP/blocks/${t}.json`);
  if (!recipes.has(t)) fail(`レシピが無い: BP/recipes/${t}.json`);
  if (!loots.has(t)) fail(`ドロップ表が無い: BP/loot_tables/blocks/${t}.json`);
}
for (const b of blocks) {
  if (!types.includes(b)) fail(`main.js に登録されていないブロック: BP/blocks/${b}.json`);
}

/* --- 言語ファイル --- */
for (const lang of ["en_US", "ja_JP"]) {
  for (const pack of ["BP", "RP"]) {
    const file = `${pack}/texts/${lang}.lang`;
    if (!exists(file)) {
      fail(`言語ファイルが無い: ${file}`);
      continue;
    }
    const text = read(file);
    for (const t of types) {
      if (!text.includes(`tile.manytnt:${t}.name=`)) fail(`${file}: ${t} の表示名が無い`);
    }
  }
  if (exists(`BP/texts/${lang}.lang`) && exists(`RP/texts/${lang}.lang`) &&
      read(`BP/texts/${lang}.lang`) !== read(`RP/texts/${lang}.lang`)) {
    fail(`BP と RP の ${lang}.lang が食い違っている`);
  }
}

/* --- テクスチャ定義と実ファイル --- */
const terrain = readJson("RP/textures/terrain_texture.json").texture_data;
for (const t of types) {
  for (const face of ["top", "side"]) {
    if (!terrain[`manytnt:${t}_${face}`]) fail(`terrain_texture.json に manytnt:${t}_${face} が無い`);
  }
}
for (const [name, entry] of Object.entries(terrain)) {
  const paths = Array.isArray(entry.textures) ? entry.textures : [entry.textures];
  for (const p of paths) {
    if (!exists(`RP/${p}.png`)) fail(`テクスチャ実ファイルが無い: RP/${p}.png (${name})`);
  }
}

/* --- blocks.json --- */
const clientBlocks = readJson("RP/blocks.json");
for (const t of types) {
  if (!clientBlocks[`manytnt:${t}`]) fail(`RP/blocks.json に manytnt:${t} が無い`);
}

/* --- manifest --- */
const uuids = new Set();
for (const pack of ["BP", "RP"]) {
  const m = readJson(`${pack}/manifest.json`);
  for (const uuid of [m.header.uuid, ...m.modules.map((mod) => mod.uuid)]) {
    if (uuids.has(uuid)) fail(`UUIDが重複している: ${uuid}`);
    uuids.add(uuid);
  }
  const desc = m.header.description;
  const claimed = desc.match(/(\d+)\s*種類/)?.[1];
  if (claimed && Number(claimed) !== types.length) {
    fail(`${pack}/manifest.json の説明が「${claimed}種類」だが実際は ${types.length} 種類`);
  }
}

/* --- 結果 --- */
console.log(`TNT ${types.length} 種類を検査`);
if (problems.length) {
  for (const p of problems) console.error(`  ❌ ${p}`);
  console.error(`\n${problems.length} 件の問題`);
  process.exit(1);
}
console.log("✅ 問題なし");
