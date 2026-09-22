#!/usr/bin/env node
// パックの整合性チェック。問題があれば一覧を出して終了コード 1 で終わる。
//   node tools/validate.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { pngSize } from "./lib/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(ROOT, "packs/BP");
const RP = join(ROOT, "packs/RP");
const require = createRequire(import.meta.url);
const errors = [];
const err = (m) => errors.push(m);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const tnts = readJson(join(ROOT, "tools/defs/tnt.json"));
const meta = readJson(join(ROOT, "tools/defs/meta.json"));
const messages = readJson(join(ROOT, "tools/defs/messages.json"));
const NS = meta.namespace;

/* 1. JSON がすべて読めること */
for (const f of [...walk(BP), ...walk(RP)].filter((f) => f.endsWith(".json"))) {
  try {
    readJson(f);
  } catch (e) {
    err(`JSON が壊れている: ${relative(ROOT, f)} (${e.message})`);
  }
}

/* 2. 言語ファイル */
function loadLang(path) {
  const map = new Map();
  if (!existsSync(path)) {
    err(`言語ファイルがない: ${relative(ROOT, path)}`);
    return map;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("##")) continue;
    const i = line.indexOf("=");
    if (i > 0) map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}
const langs = {};
for (const pack of [BP, RP]) {
  for (const l of ["ja_JP", "en_US"]) langs[`${relative(ROOT, pack)}/${l}`] = loadLang(join(pack, "texts", `${l}.lang`));
}
function needKey(key) {
  for (const [name, map] of Object.entries(langs)) if (!map.has(key)) err(`言語キーがない: ${key} (${name})`);
}

/* 3. TNT ごとの一式 */
const terrain = readJson(join(RP, "textures/terrain_texture.json")).texture_data;
const blocksJson = readJson(join(RP, "blocks.json"));
const { MinecraftItemTypes } = require("@minecraft/vanilla-data");
const vanillaItems = new Set(Object.values(MinecraftItemTypes));
const ownIds = new Set([...tnts.map((t) => `${NS}:${t.id}`), ...meta.items.map((i) => `${NS}:${i.id}`)]);
const categories = new Set(meta.categories.map((c) => c.id));
const seenIds = new Set();

function checkTexture(path) {
  const file = join(RP, `${path}.png`);
  if (!existsSync(file)) return err(`テクスチャがない: ${relative(ROOT, file)}`);
  const size = pngSize(readFileSync(file));
  if (!size || size.width !== 16 || size.height !== 16) err(`テクスチャが 16x16 でない: ${relative(ROOT, file)}`);
}
function checkIngredients(owner, list) {
  for (const item of list) {
    if (!vanillaItems.has(item) && !ownIds.has(item)) err(`${owner}: 存在しない材料 ${item}`);
    if (item.startsWith("minecraft:") && !meta.vanillaNames[item]) err(`${owner}: 材料 ${item} の表示名が meta.json にない`);
  }
}

for (const t of tnts) {
  const id = `${NS}:${t.id}`;
  if (seenIds.has(t.id)) err(`TNT の id が重複: ${t.id}`);
  seenIds.add(t.id);
  if (!categories.has(t.category)) err(`${t.id}: 未知のカテゴリ ${t.category}`);
  if (!t.ja || !t.en || !t.desc?.ja || !t.desc?.en) err(`${t.id}: 名前か説明が足りない`);
  for (const [dir, file] of [["blocks", `${t.id}.json`], ["loot_tables/blocks", `${t.id}.json`], ["recipes", `${t.id}.json`]]) {
    if (!existsSync(join(BP, dir, file))) err(`${t.id}: ${dir}/${file} がない`);
  }
  for (const part of ["top", "side"]) {
    const key = `${NS}:${t.id}_${part}`;
    if (!terrain[key]) err(`${t.id}: terrain_texture に ${key} がない`);
    else checkTexture(terrain[key].textures);
  }
  if (!blocksJson[id]) err(`${t.id}: RP/blocks.json にない`);
  needKey(`tile.${id}.name`);
  needKey(`${NS}.desc.${t.id}`);
  checkIngredients(t.id, t.recipe);
  if (typeof t.power !== "number" || t.power < 0 || t.power > 100) err(`${t.id}: power は 0〜100`);
}
checkTexture("textures/blocks/tnt_bottom");
for (const it of meta.items) {
  checkIngredients(it.id, it.recipe);
  checkTexture(it.texture);
  needKey(`item.${NS}:${it.id}.name`);
}
for (const c of meta.categories) needKey(`${NS}.cat.${c.id}`);
needKey(meta.group.name);

/* 4. マニフェストとエンジンのバージョン (B01) */
// Script API の版と、それが使える最低エンジン (npm の rc タグで確認)
const API_MIN_ENGINE = {
  "@minecraft/server": { "2.0.0": [1, 21, 90], "2.1.0": [1, 21, 100], "2.7.0": [1, 26, 20] },
  "@minecraft/server-ui": { "2.0.0": [1, 21, 100] },
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
for (const pack of [BP, RP]) {
  const m = readJson(join(pack, "manifest.json"));
  if (cmp(m.header.version, meta.version) !== 0) err(`${relative(ROOT, pack)}: manifest のバージョンが ${meta.version.join(".")} でない`);
  for (const dep of m.dependencies ?? []) {
    if (!dep.module_name) continue;
    const need = API_MIN_ENGINE[dep.module_name]?.[dep.version];
    if (!need) err(`${dep.module_name}@${dep.version} の対応エンジンが validate.mjs に登録されていない`);
    else if (cmp(m.header.min_engine_version, need) < 0) {
      err(`${dep.module_name}@${dep.version} には min_engine_version ${need.join(".")} 以上が必要`);
    }
  }
}
const bpUuid = readJson(join(BP, "manifest.json")).header.uuid;
if (bpUuid !== "5b0948bc-bb22-479e-a059-8ac3194998eb") err("BP の UUID が変わっている (既存ワールドとの互換が壊れる)");

/* 5. スクリプト */
const SCRIPTS = join(BP, "scripts");
const scriptFiles = walk(SCRIPTS).filter((f) => f.endsWith(".js"));
const allowedModules = new Set(Object.keys(meta.scriptModules));
const usedMsgKeys = new Set();
for (const f of scriptFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    err(`構文エラー: ${relative(ROOT, f)}\n${e.stderr}`);
  }
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/^\s*import[\s\S]*?from\s+"([^"]+)"/gm)) {
    const spec = m[1];
    if (spec.startsWith(".")) {
      if (!existsSync(resolve(dirname(f), spec))) err(`${relative(ROOT, f)}: import 先がない ${spec}`);
    } else if (!allowedModules.has(spec)) {
      err(`${relative(ROOT, f)}: manifest にないモジュール ${spec}`);
    }
  }
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(src)) err(`${relative(ROOT, f)}: 空の catch がある (B24)`);
  for (const m of src.matchAll(/msg\("([a-z0-9_]+)"/g)) usedMsgKeys.add(m[1]);
}
// 動的に組み立てるキー
for (const k of ["chat_on", "chat_off", "help_ignite", "help_detonator", "help_guide", "help_commands", "detonator_added", "detonator_removed", "detonator_full"]) {
  usedMsgKeys.add(k);
}
for (const k of ["nuke", "ultra_nuke", "hydrogen", "tsar", "antimatter", "armageddon"]) usedMsgKeys.add(`ach_first_${k}`);
for (const k of usedMsgKeys) {
  if (!messages[k]) err(`messages.json にキーがない: ${k}`);
  else needKey(`${NS}.msg.${k}`);
}
for (const k of Object.keys(messages)) if (!k.startsWith("//") && !usedMsgKeys.has(k)) err(`使われていないメッセージ: ${k}`);

/* 6. 効果名 */
const indexSrc = readFileSync(join(SCRIPTS, "effects/index.js"), "utf8");
const effectNames = new Set([...indexSrc.matchAll(/^\s{2}(\w+): \w+\.\w+,$/gm)].map((m) => m[1]));
for (const t of tnts) if (t.effect && !effectNames.has(t.effect)) err(`${t.id}: 効果 ${t.effect} が effects/index.js にない`);
for (const pool of ["RAINBOW_POOL", "ARMAGEDDON_POOL"]) {
  const body = indexSrc.match(new RegExp(`${pool} = \\[([\\s\\S]*?)\\];`))?.[1] ?? "";
  for (const m of body.matchAll(/"(\w+)"/g)) if (!effectNames.has(m[1])) err(`${pool}: 効果 ${m[1]} がない`);
  if (/"(nuke|ultraNuke|hydrogenBomb|tsarBomba|antimatter|armageddon)"/.test(body)) err(`${pool} に核の効果が入っている (B28)`);
}

if (errors.length) {
  console.error(`validate: ${errors.length} 件の問題\n- ` + errors.join("\n- "));
  process.exit(1);
}
console.log(`validate: OK (${tnts.length} TNT, ${scriptFiles.length} scripts, ${usedMsgKeys.size} messages)`);
