/**
 * data/tnt-defs.mjs から、繰り返しの多いアセットをまとめて生成する。
 *   実行: node tools/build-assets.mjs
 *
 * 生成するもの:
 *   BP/blocks/<id>.json              ブロック定義
 *   BP/recipes/<id>.json             作業台のレシピ
 *   BP/loot_tables/blocks/<id>.json  壊したときのドロップ
 *   BP/texts/*.lang, RP/texts/*.lang 表示名
 *   RP/blocks.json                   ブロックの音
 *   RP/textures/terrain_texture.json テクスチャの登録
 *
 * テクスチャそのものと起爆中エンティティの定義は
 * tools/generate-textures.mjs が担当する (バニラのテクスチャが要るため別)。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TNT_DEFS } from "../data/tnt-defs.mjs";
import { shade } from "./lib/png.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const NS = "manytnt";
const FORMAT = "1.21.90";

const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const writeJson = (rel, value) => write(rel, JSON.stringify(value, null, 2) + "\n");

/* ------------------------------------------------------------------ */
/*  ブロック定義                                                        */
/*                                                                     */
/*  67種類すべて同じ構成で、違うのは識別子・テクスチャ・地図の色だけ。    */
/*  地図の色は地の色を少し落としたものを使う (テクスチャと揃うように)。   */
/* ------------------------------------------------------------------ */
function blockJson(def) {
  const face = (suffix) => ({ texture: `${NS}:${def.id}_${suffix}` });
  return {
    format_version: FORMAT,
    "minecraft:block": {
      description: {
        identifier: `${NS}:${def.id}`,
        menu_category: { category: "items", group: `${NS}:tnt_group` },
      },
      components: {
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:material_instances": {
          up: face("top"),
          down: { texture: `${NS}:tnt_bottom` },
          north: face("side"),
          south: face("side"),
          east: face("side"),
          west: face("side"),
        },
        // バニラのTNTと同じく素手で即座に壊せる
        "minecraft:destructible_by_mining": { seconds_to_destroy: 0.0 },
        "minecraft:destructible_by_explosion": { explosion_resistance: 1200 },
        "minecraft:map_color": shade(def.color, -0.12),
        "minecraft:loot": `loot_tables/blocks/${def.id}.json`,
        "minecraft:redstone_conductivity": {
          redstone_conductor: true,
          allows_wire_to_step_down: true,
        },
        // 炎・溶岩・レッドストーンによる着火をスクリプト側で拾うための定期処理
        "minecraft:tick": { interval_range: [10, 10] },
        [`${NS}:ignite`]: {},
        "minecraft:flammable": { catch_chance_modifier: 15, destroy_chance_modifier: 100 },
      },
    },
  };
}

function recipeJson(def) {
  return {
    format_version: "1.21.0",
    "minecraft:recipe_shapeless": {
      description: { identifier: `${NS}:${def.id}_recipe` },
      tags: ["crafting_table"],
      unlock: [{ item: "minecraft:tnt" }],
      ingredients: def.recipe.ingredients.map((item) => ({ item })),
      result: { item: `${NS}:${def.id}`, count: def.recipe.count ?? 1 },
    },
  };
}

function lootJson(def) {
  return {
    pools: [{ rolls: 1, entries: [{ type: "item", name: `${NS}:${def.id}`, weight: 1 }] }],
  };
}

/* ------------------------------------------------------------------ */
/*  言語ファイル                                                        */
/* ------------------------------------------------------------------ */
const PACK_TEXT = {
  ja_JP: {
    header: "## many_tnt addon - Japanese",
    detonator: "リモート起爆装置",
    group: "いろんなTNT",
    packName: "いろんなTNT追加アドオン",
    packDesc: (n) => `${n}種類のユニークなTNTを追加します`,
  },
  en_US: {
    header: "## many_tnt addon - English",
    detonator: "Remote Detonator",
    group: "Many TNT",
    packName: "Many TNT Addon",
    packDesc: (n) => `Adds ${n} unique kinds of TNT`,
  },
};

function langFile(locale) {
  const t = PACK_TEXT[locale];
  const key = locale === "ja_JP" ? "ja" : "en";
  const lines = [t.header];
  for (const def of TNT_DEFS) lines.push(`tile.${NS}:${def.id}.name=${def.name[key]}`);
  lines.push(
    `item.${NS}:detonator=${t.detonator}`,
    `itemGroup.name.tnt=${t.group}`,
    `pack.name=${t.packName}`,
    `pack.description=${t.packDesc(TNT_DEFS.length)}`,
    ""
  );
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
let count = 0;
for (const def of TNT_DEFS) {
  writeJson(`BP/blocks/${def.id}.json`, blockJson(def));
  writeJson(`BP/recipes/${def.id}.json`, recipeJson(def));
  writeJson(`BP/loot_tables/blocks/${def.id}.json`, lootJson(def));
  count += 3;
}

for (const locale of ["ja_JP", "en_US"]) {
  const text = langFile(locale);
  // BP と RP で内容がずれると表示が食い違うので、必ず同じものを書く
  write(`BP/texts/${locale}.lang`, text);
  write(`RP/texts/${locale}.lang`, text);
  count += 2;
}
for (const pack of ["BP", "RP"]) {
  writeJson(`${pack}/texts/languages.json`, ["en_US", "ja_JP"]);
  count++;
}

// manifest の説明にある種類数も、手で直し忘れないようここから書き換える
for (const pack of ["BP", "RP"]) {
  const rel = `${pack}/manifest.json`;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  manifest.header.description = `${TNT_DEFS.length}種類のユニークなTNTを追加します (${pack})`;
  writeJson(rel, manifest);
  count++;
}

writeJson("RP/blocks.json", {
  format_version: "1.21.40",
  ...Object.fromEntries(TNT_DEFS.map((d) => [`${NS}:${d.id}`, { sound: "grass" }])),
});
count++;

writeJson("RP/textures/terrain_texture.json", {
  num_mip_levels: 4,
  padding: 8,
  resource_pack_name: "many_tnt",
  texture_name: "atlas.terrain",
  texture_data: {
    [`${NS}:tnt_bottom`]: { textures: "textures/blocks/tnt_bottom" },
    ...Object.fromEntries(
      TNT_DEFS.flatMap((d) => [
        [`${NS}:${d.id}_top`, { textures: `textures/blocks/${d.id}_top` }],
        [`${NS}:${d.id}_side`, { textures: `textures/blocks/${d.id}_side` }],
      ])
    ),
  },
});
count++;

/* ------------------------------------------------------------------ */
/*  スクリプトが実行時に見る表                                          */
/*                                                                     */
/*  効果の実体は effects/ に手書きしてあり、ここでは名前だけを持つ。      */
/*  名前 → 関数 の対応表 (effects/index.js) も、effects/ にある          */
/*  export された関数を読み取って作る。                                 */
/* ------------------------------------------------------------------ */
const RUNTIME_KEYS = ["power", "breaks", "fire", "underwater", "trail", "effect",
                      "launchUp", "gravityPull", "magnetPull", "gacha"];

const tableRows = TNT_DEFS.map((def) => {
  const row = { id: def.id };
  for (const key of RUNTIME_KEYS) if (def[key] !== undefined) row[key] = def[key];
  return "  " + JSON.stringify(row) + ",";
}).join("\n");

write(
  "BP/scripts/data/tnt-table.js",
  `/**\n * TNTの種類ごとの設定。\n *\n * このファイルは data/tnt-defs.mjs から自動生成される。直接編集しないこと。\n * 変更するときは data/tnt-defs.mjs を直して \`node tools/build-assets.mjs\` を実行する。\n */\nexport const TNT_TABLE = [\n${tableRows}\n];\n`
);
count++;

const effectsDir = path.join(root, "BP/scripts/effects");
const effectFiles = fs.readdirSync(effectsDir).filter((f) => f.endsWith(".js") && f !== "index.js").sort();
const owner = new Map();
for (const file of effectFiles) {
  const text = fs.readFileSync(path.join(effectsDir, file), "utf8");
  for (const m of text.matchAll(/^export function (\w+Effect)\s*\(/gm)) owner.set(m[1], file);
}
const usedEffects = [...new Set(TNT_DEFS.map((d) => d.effect).filter(Boolean))].sort();
const unknown = usedEffects.filter((name) => !owner.has(name));
if (unknown.length) {
  console.error(`  ❌ effects/ に無い効果関数が data/tnt-defs.mjs から参照されている: ${unknown.join(", ")}`);
  process.exit(1);
}
const byFile = new Map();
for (const name of usedEffects) {
  const file = owner.get(name);
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(name);
}
const importLines = [...byFile.entries()]
  .map(([file, names]) => `import { ${names.join(", ")} } from "./${file}";`)
  .join("\n");
const mapLines = usedEffects.map((name) => `  ${name},`).join("\n");
write(
  "BP/scripts/effects/index.js",
  `/**\n * 効果の名前から実体を引くための表。\n *\n * このファイルは自動生成される (tools/build-assets.mjs)。直接編集しないこと。\n * 効果そのものは同じフォルダの各ファイルに手書きしてある。\n */\n${importLines}\n\nexport const EFFECTS = {\n${mapLines}\n};\n`
);
count++;

console.log(`✅ ${count} ファイルを生成した (TNT ${TNT_DEFS.length} 種類, 効果 ${usedEffects.length} 個)`);
