#!/usr/bin/env node
// tools/defs/*.json (正本) から、パック内の定義ファイル一式を生成する。
// 手書きのファイル (scripts/ 配下の手書きモジュール、既存テクスチャ、pack_icon) には触れない。
//
//   node tools/generate.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { encodePng } from "./lib/png.mjs";
import { tntSide, tntTop, guideIcon } from "./lib/textures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(ROOT, "packs/BP");
const RP = join(ROOT, "packs/RP");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const tnts = readJson("tools/defs/tnt.json");
const meta = readJson("tools/defs/meta.json");
const messages = readJson("tools/defs/messages.json");
const NS = meta.namespace;

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof content === "string" || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2) + "\n");
}
function resetDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

/* ---------------- マニフェスト ---------------- */
const version = meta.version;
write(join(BP, "manifest.json"), {
  format_version: 2,
  header: {
    name: "pack.name",
    description: "pack.description",
    uuid: meta.uuids.bpHeader,
    version,
    min_engine_version: meta.minEngineVersion,
  },
  modules: [
    { type: "data", uuid: meta.uuids.bpData, version },
    { type: "script", language: "javascript", uuid: meta.uuids.bpScript, entry: "scripts/main.js", version },
  ],
  dependencies: [
    ...Object.entries(meta.scriptModules).map(([module_name, v]) => ({ module_name, version: v })),
    { uuid: meta.uuids.rpHeader, version },
  ],
});
write(join(RP, "manifest.json"), {
  format_version: 2,
  header: {
    name: "pack.name",
    description: "pack.description",
    uuid: meta.uuids.rpHeader,
    version,
    min_engine_version: meta.minEngineVersion,
  },
  modules: [{ type: "resources", uuid: meta.uuids.rpResources, version }],
  dependencies: [{ uuid: meta.uuids.bpHeader, version }],
});

/* ---------------- ブロック / ルートテーブル / レシピ ---------------- */
resetDir(join(BP, "blocks"));
resetDir(join(BP, "loot_tables/blocks"));
resetDir(join(BP, "recipes"));
rmSync(join(BP, "animations"), { recursive: true, force: true }); // 空フォルダだった

for (const t of tnts) {
  const id = `${NS}:${t.id}`;
  const side = `${NS}:${t.id}_side`;
  const components = {
    "minecraft:geometry": "minecraft:geometry.full_block",
    "minecraft:material_instances": {
      up: { texture: `${NS}:${t.id}_top` },
      down: { texture: `${NS}:tnt_bottom` },
      north: { texture: side },
      south: { texture: side },
      east: { texture: side },
      west: { texture: side },
    },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 0.0 },
    "minecraft:destructible_by_explosion": { explosion_resistance: 1200 },
    "minecraft:map_color": t.color,
    "minecraft:loot": `loot_tables/blocks/${t.id}.json`,
    "minecraft:redstone_conductivity": { redstone_conductor: true, allows_wire_to_step_down: true },
    "minecraft:redstone_consumer": { min_power: 1 },
    "minecraft:tick": { interval_range: [10, 10] },
    "minecraft:flammable": { catch_chance_modifier: 15, destroy_chance_modifier: 0 }, // B15
    [`${NS}:ignite`]: {},
  };
  if (t.landmine) components[`${NS}:landmine`] = {};
  write(join(BP, "blocks", `${t.id}.json`), {
    format_version: meta.blockFormatVersion,
    "minecraft:block": {
      description: { identifier: id, menu_category: { category: "items", group: meta.group.name } },
      components,
    },
  });
  write(join(BP, "loot_tables/blocks", `${t.id}.json`), {
    pools: [{ rolls: 1, entries: [{ type: "item", name: id, weight: 1 }] }],
  });
  write(join(BP, "recipes", `${t.id}.json`), shapeless(`${NS}:${t.id}_recipe`, t.recipe, id, "minecraft:tnt"));
}

function shapeless(identifier, ingredients, result, unlock) {
  return {
    format_version: "1.21.0",
    "minecraft:recipe_shapeless": {
      description: { identifier },
      tags: ["crafting_table"],
      unlock: [{ item: unlock }],
      ingredients: ingredients.map((item) => ({ item })),
      result: { item: result, count: 1 },
    },
  };
}

/* ---------------- アイテム ---------------- */
resetDir(join(BP, "items"));
const itemTextures = {};
for (const it of meta.items) {
  const id = `${NS}:${it.id}`;
  write(join(BP, "items", `${it.id}.json`), {
    format_version: "1.21.90",
    "minecraft:item": {
      description: { identifier: id, menu_category: { category: "items", group: meta.group.name } },
      components: {
        "minecraft:icon": `${NS}_${it.id}`,
        "minecraft:display_name": { value: `item.${id}.name` },
        "minecraft:max_stack_size": it.maxStack,
      },
    },
  });
  write(join(BP, "recipes", `${it.id}.json`), shapeless(`${NS}:${it.id}_recipe`, it.recipe, id, it.unlock));
  itemTextures[`${NS}_${it.id}`] = { textures: it.texture };
}
write(join(RP, "textures/item_texture.json"), {
  resource_pack_name: "many_tnt",
  texture_name: "atlas.items",
  texture_data: itemTextures,
});
write(join(RP, "textures/items/tnt_guide.png"), encodePng(guideIcon()));

/* ---------------- クリエイティブのグループ (B14) ---------------- */
write(join(BP, "item_catalog/crafting_item_catalog.json"), {
  format_version: "1.21.60",
  "minecraft:crafting_items_catalog": {
    categories: [
      {
        category_name: "items",
        groups: [
          {
            group_identifier: { icon: meta.group.icon, name: meta.group.name },
            items: [...tnts.map((t) => `${NS}:${t.id}`), ...meta.items.map((i) => `${NS}:${i.id}`)],
          },
        ],
      },
    ],
  },
});

/* ---------------- RP: blocks.json / terrain_texture / テクスチャ ---------------- */
const blocksJson = { format_version: "1.21.40" };
const terrain = { "manytnt:tnt_bottom": { textures: "textures/blocks/tnt_bottom" } };
for (const t of tnts) {
  blocksJson[`${NS}:${t.id}`] = { sound: "grass" };
  for (const part of ["top", "side"]) {
    terrain[`${NS}:${t.id}_${part}`] = { textures: `textures/blocks/${t.id}_${part}` };
  }
  if (t.texture) {
    write(join(RP, `textures/blocks/${t.id}_side.png`), encodePng(tntSide(t.texture)));
    write(join(RP, `textures/blocks/${t.id}_top.png`), encodePng(tntTop(t.texture)));
  }
}
write(join(RP, "blocks.json"), blocksJson);
write(join(RP, "textures/terrain_texture.json"), {
  num_mip_levels: 4,
  padding: 8,
  resource_pack_name: "many_tnt",
  texture_name: "atlas.terrain",
  texture_data: terrain,
});

/* ---------------- 言語ファイル ---------------- */
function langLines(lang) {
  const L = lang === "ja" ? 0 : 1;
  const count = tnts.length;
  const lines = [`## many_tnt addon - ${lang === "ja" ? "Japanese" : "English"} (generated by tools/generate.mjs)`];
  lines.push(`pack.name=${meta.pack[lang].name}`);
  lines.push(`pack.description=${meta.pack[lang].description.replace("%d", count)}`);
  lines.push(`${meta.group.name}=${meta.group[lang]}`);
  for (const t of tnts) lines.push(`tile.${NS}:${t.id}.name=${t[lang]}`);
  for (const t of tnts) lines.push(`${NS}.desc.${t.id}=${t.desc[lang]}`);
  for (const it of meta.items) lines.push(`item.${NS}:${it.id}.name=${it[lang]}`);
  for (const c of meta.categories) lines.push(`${NS}.cat.${c.id}=${c[lang]}`);
  for (const [id, names] of Object.entries(meta.vanillaNames)) {
    lines.push(`${NS}.ing.${id.replace("minecraft:", "")}=${names[L]}`);
  }
  for (const [key, v] of Object.entries(messages)) {
    if (key.startsWith("//")) continue;
    lines.push(`${NS}.msg.${key}=${v[lang]}`);
  }
  return lines.join("\n") + "\n";
}
for (const pack of [BP, RP]) {
  write(join(pack, "texts/ja_JP.lang"), langLines("ja"));
  write(join(pack, "texts/en_US.lang"), langLines("en"));
  write(join(pack, "texts/languages.json"), ["en_US", "ja_JP"]);
}

/* ---------------- スクリプト用の生成モジュール ---------------- */
const require = createRequire(import.meta.url);
let containers = [];
try {
  const { MinecraftBlockTypes } = require("@minecraft/vanilla-data");
  containers = Object.values(MinecraftBlockTypes)
    .filter((b) =>
      /(chest|shulker_box|barrel|furnace|smoker|hopper|dispenser|dropper|brewing_stand|crafter|chiseled_bookshelf|decorated_pot|lectern|jukebox|_shelf)$/.test(b)
    )
    .sort();
} catch (err) {
  console.error("@minecraft/vanilla-data が見つかりません。npm install を実行してください。");
  process.exit(1);
}

const scriptDefs = tnts.map((t) => {
  const d = { ...t, id: `${NS}:${t.id}` };
  delete d.desc;
  delete d.texture;
  delete d.ja;
  delete d.en;
  d.name = { ja: t.ja, en: t.en };
  return d;
});
const header = "// このファイルは tools/generate.mjs が生成します。直接編集しないでください。\n";
write(
  join(BP, "scripts/generated/defs.js"),
  header +
    `export const TNT_DEFS = ${JSON.stringify(scriptDefs, null, 2)};\n\n` +
    `export const CATEGORIES = ${JSON.stringify(meta.categories.map((c) => c.id))};\n\n` +
    `export const CONTAINER_BLOCKS = ${JSON.stringify(containers, null, 2)};\n`
);

/* ---------------- ドキュメント: TNT一覧 ---------------- */
const ingName = (id) =>
  id.startsWith(`${NS}:`) ? tnts.find((t) => `${NS}:${t.id}` === id)?.ja ?? id : meta.vanillaNames[id]?.[0] ?? id;
const doc = [
  "# TNT一覧",
  "",
  "> このファイルは `tools/generate.mjs` が `tools/defs/tnt.json` から生成します。直接編集しないでください。",
  "",
  `全 ${tnts.length} 種類。レシピはすべて作業台での「形不問」です。🆕 は v31 で追加された種類、☢ は核系 (設定で禁止できます) です。`,
];
for (const c of meta.categories) {
  doc.push("", `## ${c.ja} (${c.en})`, "", "| TNT | 威力 | 効果 | レシピ |", "|---|---|---|---|");
  for (const t of tnts.filter((x) => x.category === c.id)) {
    const mark = `${t.texture ? " 🆕" : ""}${t.nuclear ? " ☢" : ""}`;
    doc.push(`| ${t.ja}${mark}<br>${t.en} | ${t.power || "-"} | ${t.desc.ja} | ${t.recipe.map(ingName).join(" + ")} |`);
  }
}
doc.push("", "## アイテム", "", "| アイテム | レシピ |", "|---|---|");
for (const it of meta.items) doc.push(`| ${it.ja}<br>${it.en} | ${it.recipe.map(ingName).join(" + ")} |`);
write(join(ROOT, "docs/TNT_LIST.md"), doc.join("\n") + "\n");

console.log(`generated: ${tnts.length} TNT, ${meta.items.length} items, ${containers.length} container types`);
