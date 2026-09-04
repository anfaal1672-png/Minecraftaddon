/**
 * data/ から、繰り返しの多い JSON と言語ファイルを生成する。
 *
 *   BP/blocks/<id>.json              ブロック定義
 *   BP/recipes/<id>.json             作業台のレシピ
 *   BP/loot_tables/blocks/<id>.json  壊したときのドロップ
 *   BP/items/*.json                  道具 (遠隔起爆装置・図鑑)
 *   BP/texts/*.lang, RP/texts/*.lang 表示名
 *   RP/blocks.json                   ブロックの音
 *   RP/textures/terrain_texture.json ブロックテクスチャの登録
 *   RP/textures/item_texture.json    アイテムテクスチャの登録
 *   BP/manifest.json, RP/manifest.json の説明文
 */
import { NAMESPACE, TNT_DEFS } from "../../data/index.mjs";
import { CATEGORIES } from "../../data/categories.mjs";
import { GEAR_BLOCKS, GEAR_ITEMS, THROWABLES, TOOLS } from "../../data/gear.mjs";
import { pruneDir, readJson, write, writeJson } from "../lib/io.mjs";
import { shade } from "../lib/png.mjs";

const NS = NAMESPACE;
const BLOCK_FORMAT = "1.21.90";
const RECIPE_FORMAT = "1.21.0";
const ITEM_FORMAT = "1.21.90";

/* ------------------------------------------------------------------ */
/*  ブロック                                                           */
/*                                                                     */
/*  全種類が同じ構成で、違うのは識別子・テクスチャ・地図の色だけ。       */
/*  地図の色は地の色を少し落としたものを使う (テクスチャと揃うように)。   */
/* ------------------------------------------------------------------ */
export function blockJson(def) {
  const face = (suffix) => ({ texture: `${NS}:${def.id}_${suffix}` });
  return {
    format_version: BLOCK_FORMAT,
    "minecraft:block": {
      description: {
        identifier: `${NS}:${def.id}`,
        menu_category: { category: "items", group: `${NS}:${def.category}_group` },
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
        "minecraft:map_color": shade(def.visual.color, -0.12),
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

export function recipeJson(id, ingredients, count = 1) {
  return {
    format_version: RECIPE_FORMAT,
    "minecraft:recipe_shapeless": {
      description: { identifier: `${NS}:${id}_recipe` },
      tags: ["crafting_table"],
      unlock: [{ item: "minecraft:tnt" }],
      ingredients: ingredients.map((item) => ({ item })),
      result: { item: `${NS}:${id}`, count },
    },
  };
}

export function lootJson(id) {
  return { pools: [{ rolls: 1, entries: [{ type: "item", name: `${NS}:${id}`, weight: 1 }] }] };
}

/**
 * 道具のアイテム定義。手に持って使うもの。
 */
export function itemJson(tool) {
  return {
    format_version: ITEM_FORMAT,
    "minecraft:item": {
      description: {
        identifier: `${NS}:${tool.id}`,
        menu_category: { category: "items", group: `${NS}:gear_group` },
      },
      components: {
        "minecraft:icon": `${NS}_${tool.id}`,
        "minecraft:max_stack_size": 1,
        "minecraft:hand_equipped": true,
      },
    },
  };
}

/**
 * 投げる爆弾のアイテム定義。
 *
 * 投げる仕組みはバニラの wind_charge と同じ作りで、
 * minecraft:projectile が飛ばすエンティティを、
 * minecraft:throwable が投げ方を決める。
 * 当たったときに何が起きるかは、スクリプト側で受け取って組み立てる。
 */
export function throwableJson(bomb) {
  return {
    format_version: ITEM_FORMAT,
    "minecraft:item": {
      description: {
        identifier: `${NS}:${bomb.id}`,
        menu_category: { category: "items", group: `${NS}:gear_group` },
      },
      components: {
        "minecraft:icon": `${NS}_${bomb.id}`,
        "minecraft:max_stack_size": 16,
        "minecraft:hand_equipped": false,
        "minecraft:cooldown": { category: "manytnt_throw", duration: 0.5 },
        "minecraft:projectile": { projectile_entity: `${NS}:${bomb.id}_projectile` },
        "minecraft:throwable": {
          do_swing_animation: true,
          launch_power_scale: bomb.power,
          max_launch_power: bomb.power,
        },
      },
    },
  };
}

/**
 * 仕掛けブロックの定義。TNTと同じ見た目の作りにしてある。
 */
export function gearBlockJson(block) {
  const face = (suffix) => ({ texture: `${NS}:${block.id}_${suffix}` });
  const components = {
    "minecraft:geometry": "minecraft:geometry.full_block",
    "minecraft:material_instances": {
      up: face("top"),
      down: face("top"),
      north: face("side"),
      south: face("side"),
      east: face("side"),
      west: face("side"),
    },
    "minecraft:map_color": shade(block.visual.color, -0.12),
    "minecraft:loot": `loot_tables/blocks/${block.id}.json`,
    "minecraft:destructible_by_mining": { seconds_to_destroy: block.id === "blast_proof_block" ? 6.0 : 0.6 },
    "minecraft:destructible_by_explosion": { explosion_resistance: 1200 },
    "minecraft:redstone_conductivity": { redstone_conductor: true, allows_wire_to_step_down: true },
  };
  if (block.component) {
    // レッドストーンや延焼を拾うために定期処理が要る
    components["minecraft:tick"] = { interval_range: [5, 5] };
    components[block.component] = {};
  }
  return {
    format_version: BLOCK_FORMAT,
    "minecraft:block": {
      description: {
        identifier: `${NS}:${block.id}`,
        menu_category: { category: "items", group: `${NS}:gear_group` },
      },
      components,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  言語ファイル                                                       */
/* ------------------------------------------------------------------ */
const PACK_TEXT = {
  ja_JP: {
    header: "## many_tnt addon - Japanese",
    packName: "いろんなTNT追加アドオン",
    packDesc: (n) => `${n}種類のユニークなTNTを追加します`,
    groupSuffix: "TNT",
    gearGroup: "TNTの道具",
  },
  en_US: {
    header: "## many_tnt addon - English",
    packName: "Many TNT Addon",
    packDesc: (n) => `Adds ${n} unique kinds of TNT`,
    groupSuffix: "TNT",
    gearGroup: "TNT Gear",
  },
};

export function langFile(locale) {
  const text = PACK_TEXT[locale];
  const key = locale === "ja_JP" ? "ja" : "en";
  const lines = [text.header];

  for (const def of TNT_DEFS) lines.push(`tile.${NS}:${def.id}.name=${def.name[key]}`);
  for (const gear of GEAR_ITEMS) lines.push(`item.${NS}:${gear.id}=${gear.name[key]}`);
  for (const block of GEAR_BLOCKS) lines.push(`tile.${NS}:${block.id}.name=${block.name[key]}`);
  for (const category of CATEGORIES) {
    lines.push(`itemGroup.name.${NS}:${category.id}_group=${category.name[key]} ${text.groupSuffix}`);
  }
  lines.push(`itemGroup.name.${NS}:gear_group=${text.gearGroup}`);
  lines.push(
    `pack.name=${text.packName}`,
    `pack.description=${text.packDesc(TNT_DEFS.length)}`,
    ""
  );
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
export function generateAssets() {
  const removed = [];

  for (const def of TNT_DEFS) {
    writeJson(`BP/blocks/${def.id}.json`, blockJson(def));
    writeJson(`BP/recipes/${def.id}.json`, recipeJson(def.id, def.recipe.ingredients, def.recipe.count ?? 1));
    writeJson(`BP/loot_tables/blocks/${def.id}.json`, lootJson(def.id));
  }
  for (const tool of TOOLS) {
    writeJson(`BP/items/${tool.id}.json`, itemJson(tool));
    writeJson(`BP/recipes/${tool.id}.json`, recipeJson(tool.id, tool.recipe.ingredients, tool.recipe.count ?? 1));
  }
  for (const bomb of THROWABLES) {
    writeJson(`BP/items/${bomb.id}.json`, throwableJson(bomb));
    writeJson(`BP/recipes/${bomb.id}.json`, recipeJson(bomb.id, bomb.recipe.ingredients, bomb.recipe.count ?? 1));
  }
  for (const block of GEAR_BLOCKS) {
    writeJson(`BP/blocks/${block.id}.json`, gearBlockJson(block));
    writeJson(`BP/loot_tables/blocks/${block.id}.json`, lootJson(block.id));
    writeJson(`BP/recipes/${block.id}.json`, recipeJson(block.id, block.recipe.ingredients, block.recipe.count ?? 1));
  }

  // 種類を減らしたときに古いファイルが残らないようにする
  const blockFiles = new Set([
    ...TNT_DEFS.map((d) => `${d.id}.json`),
    ...GEAR_BLOCKS.map((b) => `${b.id}.json`),
  ]);
  const itemFiles = new Set(GEAR_ITEMS.map((g) => `${g.id}.json`));
  const recipeFiles = new Set([...blockFiles, ...itemFiles]);
  removed.push(...pruneDir("BP/blocks", blockFiles, (n) => n.endsWith(".json")));
  removed.push(...pruneDir("BP/loot_tables/blocks", blockFiles, (n) => n.endsWith(".json")));
  removed.push(...pruneDir("BP/recipes", recipeFiles, (n) => n.endsWith(".json")));
  removed.push(...pruneDir("BP/items", itemFiles, (n) => n.endsWith(".json")));

  for (const locale of ["ja_JP", "en_US"]) {
    const text = langFile(locale);
    // BP と RP で内容がずれると表示が食い違うので、必ず同じものを書く
    write(`BP/texts/${locale}.lang`, text);
    write(`RP/texts/${locale}.lang`, text);
  }
  for (const pack of ["BP", "RP"]) {
    writeJson(`${pack}/texts/languages.json`, ["en_US", "ja_JP"]);
  }

  // manifest の説明にある種類数も、手で直し忘れないようここから書き換える
  for (const pack of ["BP", "RP"]) {
    const manifest = readJson(`${pack}/manifest.json`);
    manifest.header.description = `${TNT_DEFS.length}種類のユニークなTNTを追加します (${pack})`;
    writeJson(`${pack}/manifest.json`, manifest);
  }

  writeJson("RP/blocks.json", {
    format_version: "1.21.40",
    ...Object.fromEntries(TNT_DEFS.map((d) => [`${NS}:${d.id}`, { sound: "grass" }])),
    ...Object.fromEntries(GEAR_BLOCKS.map((b) => [`${NS}:${b.id}`, { sound: b.sound }])),
  });

  writeJson("RP/textures/terrain_texture.json", {
    num_mip_levels: 4,
    padding: 8,
    resource_pack_name: "many_tnt",
    texture_name: "atlas.terrain",
    texture_data: {
      [`${NS}:tnt_bottom`]: { textures: "textures/blocks/tnt_bottom" },
      ...Object.fromEntries(
        [...TNT_DEFS, ...GEAR_BLOCKS].flatMap((d) => [
          [`${NS}:${d.id}_top`, { textures: `textures/blocks/${d.id}_top` }],
          [`${NS}:${d.id}_side`, { textures: `textures/blocks/${d.id}_side` }],
        ])
      ),
    },
  });

  writeJson("RP/textures/item_texture.json", {
    resource_pack_name: "many_tnt",
    texture_name: "atlas.items",
    texture_data: Object.fromEntries(
      GEAR_ITEMS.map((g) => [`${NS}_${g.id}`, { textures: `textures/items/${g.id}` }])
    ),
  });

  return removed;
}
