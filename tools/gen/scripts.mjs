/**
 * スクリプトが実行時に読む表を生成する。
 *
 *   BP/scripts/data/tnt-table.js   TNT1件ぶんの設定
 *   BP/scripts/data/categories.js  カテゴリの一覧
 *   BP/scripts/effects/index.js    効果の名前 → 実体
 *
 * 効果の実体は BP/scripts/effects/ に手書きしてある。ここではその中から
 * export された関数を読み取って対応表を作るので、data/ に書いた効果名の
 * 打ち間違いはビルド時に必ず見つかる。
 */
import { TNT_DEFS } from "../../data/index.mjs";
import { CATEGORIES } from "../../data/categories.mjs";
import { listFiles, readText, write } from "../lib/io.mjs";

const GENERATED_HEADER = (source) =>
  `/**\n * このファイルは自動生成される (tools/build.mjs)。直接編集しないこと。\n *\n * 元になっているもの: ${source}\n */\n`;

/** 実行時に必要な項目だけを取り出す */
export function tableRow(def) {
  return {
    id: def.id,
    cat: def.category,
    fuse: def.fuse,
    power: def.blast.power,
    breaks: !!def.blast.breaks,
    fire: !!def.blast.fire,
    underwater: !!def.blast.underwater,
    trail: def.visual.trail ?? null,
    effect: def.effect,
    traits: Object.keys(def.traits),
    // 核系と災厄系は導火線の間に警報が鳴る
    warns: def.category === "nuclear" || def.category === "chaos",
    name: def.name,
    desc: def.desc,
    recipe: { items: def.recipe.ingredients, count: def.recipe.count ?? 1 },
  };
}

export function tntTableSource() {
  const rows = TNT_DEFS.map((def) => "  " + JSON.stringify(tableRow(def)) + ",").join("\n");
  return (
    GENERATED_HEADER("data/tnt/*.mjs") +
    "\n/** TNT1種類ぶんの設定。並び順が、そのまま起爆中エンティティの見た目の番号になる */\n" +
    `export const TNT_TABLE = [\n${rows}\n];\n`
  );
}

export function categoriesSource() {
  const rows = CATEGORIES.map((c) =>
    "  " + JSON.stringify({ id: c.id, name: c.name, icon: c.icon }) + ","
  ).join("\n");
  return (
    GENERATED_HEADER("data/categories.mjs") +
    "\n/** 図鑑とクリエイティブメニューの並び */\n" +
    `export const CATEGORIES = [\n${rows}\n];\n`
  );
}

/**
 * effects/ にある効果関数を洗い出す。
 * @returns Map<関数名, ファイル名>
 */
export function findEffectFunctions() {
  const owner = new Map();
  for (const file of listFiles("BP/scripts/effects", (f) => f.endsWith(".js") && f !== "index.js")) {
    const text = readText(`BP/scripts/effects/${file}`);
    // export function xxxEffect(...) と export const xxxEffect = ... の両方を拾う
    for (const m of text.matchAll(/^export (?:function|const) (\w+Effect)\b/gm)) {
      owner.set(m[1], file);
    }
  }
  return owner;
}

export function effectsIndexSource(owner) {
  const used = [...new Set(TNT_DEFS.map((d) => d.effect).filter(Boolean))].sort();
  const missing = used.filter((name) => !owner.has(name));
  if (missing.length) {
    throw new Error(`effects/ に無い効果が data/ から参照されている: ${missing.join(", ")}`);
  }

  const byFile = new Map();
  for (const name of used) {
    const file = owner.get(name);
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(name);
  }
  const imports = [...byFile.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([file, names]) => `import { ${names.join(", ")} } from "./${file}";`)
    .join("\n");
  const entries = used.map((name) => `  ${name},`).join("\n");

  return (
    GENERATED_HEADER("data/tnt/*.mjs と BP/scripts/effects/*.js") +
    `${imports}\n\n/** 効果の名前から実体を引くための表 */\nexport const EFFECTS = {\n${entries}\n};\n`
  );
}

export function generateScripts() {
  write("BP/scripts/data/tnt-table.js", tntTableSource());
  write("BP/scripts/data/categories.js", categoriesSource());
  const owner = findEffectFunctions();
  write("BP/scripts/effects/index.js", effectsIndexSource(owner));
  return { effects: [...new Set(TNT_DEFS.map((d) => d.effect).filter(Boolean))].length, defined: owner.size };
}
