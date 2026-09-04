/**
 * 生成した JSON を、Mojang が公開している正式なスキーマと突き合わせる。
 *
 * 統合版のアドオンは、知らないコンポーネントを書いても黙って無視されるだけで、
 * 「書いたのに効いていない」ことに気づけない。実際にこの検査で
 * ブロックの破壊時コールバックの名前が違っていたのが見つかっている。
 *
 * スキーマは bedrock-samples の metadata/json_schemas にあり、
 * 版ごとにフォルダが分かれている。こちらが宣言した format_version 以下で
 * いちばん新しい版のものを使う。手元に無ければこの検査は飛ばす。
 */
import fs from "node:fs";
import path from "node:path";
import { at, readJson } from "./lib/io.mjs";

const SEARCH_PATHS = [
  process.env.VANILLA_SCHEMAS,
  at("../mojang/bedrock-samples/metadata/json_schemas/server"),
  at("../bedrock-samples/metadata/json_schemas/server"),
  at("vendor/bedrock-samples/metadata/json_schemas/server"),
].filter(Boolean);

function findSchemaRoot() {
  for (const dir of SEARCH_PATHS) {
    if (fs.existsSync(path.join(dir, "block"))) return dir;
  }
  return null;
}

/** "1.21.90" を並べ替えできる数にする */
function versionKey(text) {
  const parts = text.split(".").map((n) => Number.parseInt(n, 10) || 0);
  return parts[0] * 1e6 + parts[1] * 1e3 + parts[2];
}

/**
 * 宣言した format_version 以下で、いちばん新しいスキーマの版を選ぶ。
 * どれも上回っている場合はいちばん古いものを使う (無いよりまし)。
 */
export function pickSchemaVersion(available, declared) {
  const usable = available
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => versionKey(a) - versionKey(b));
  if (usable.length === 0) return null;
  const target = versionKey(declared);
  let chosen = usable[0];
  for (const v of usable) if (versionKey(v) <= target) chosen = v;
  return chosen;
}

/**
 * そのフォルダから、使ってよいコンポーネント名を読む。
 *
 * 版によってファイルの作りが違う。Components.json が置かれていることも、
 * Blocks.json の definitions の奥に入っていることもあるので、両方を見る。
 */
function componentNames(root, family, version) {
  const dir = path.join(root, family, version);
  if (!fs.existsSync(dir)) return null;

  const direct = path.join(dir, "Components.json");
  if (fs.existsSync(direct)) {
    const schema = JSON.parse(fs.readFileSync(direct, "utf8"));
    const names = Object.keys(schema.properties ?? {});
    if (names.length > 0) return new Set(names);
  }

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const found = digForComponents(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    if (found) return found;
  }
  return null;
}

/** スキーマの奥から「minecraft: が並んだ properties」を探す */
function digForComponents(node, depth = 0) {
  if (depth > 6 || !node || typeof node !== "object") return null;
  const props = node.properties;
  if (props && typeof props === "object") {
    const names = Object.keys(props).filter((k) => k.startsWith("minecraft:"));
    // 20個以上あればコンポーネント表とみなす (説明文の中の1〜2個と区別する)
    if (names.length >= 20) return new Set(names);
  }
  for (const value of Object.values(node)) {
    const found = digForComponents(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function listVersions(root, family) {
  const dir = path.join(root, family);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

/** BP 以下の JSON を集める */
function jsonFiles(rel) {
  const dir = at(rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => `${rel}/${n}`);
}

/**
 * 生成物のコンポーネント名を、正式なスキーマと突き合わせる。
 * 自作のカスタムコンポーネント (manytnt:*) は対象外。
 */
export function checkAgainstSchemas() {
  const root = findSchemaRoot();
  if (!root) {
    return {
      skipped: true,
      reason:
        "正式なスキーマが見つからないので、この検査は飛ばした。\n" +
        "  git clone --depth 1 https://github.com/Mojang/bedrock-samples ../bedrock-samples",
      problems: [],
    };
  }

  const problems = [];
  const used = [];

  const families = [
    { family: "block", files: jsonFiles("BP/blocks"), key: "minecraft:block" },
    { family: "item", files: jsonFiles("BP/items"), key: "minecraft:item" },
  ];

  for (const { family, files, key } of families) {
    if (files.length === 0) continue;
    const declared = readJson(files[0]).format_version;
    const version = pickSchemaVersion(listVersions(root, family), declared);
    if (!version) {
      problems.push(`${family}: 使えるスキーマの版が無い`);
      continue;
    }
    const allowed = componentNames(root, family, version);
    if (!allowed) {
      problems.push(`${family}: ${version} に Components.json が無い`);
      continue;
    }
    used.push(`${family} ${declared} → スキーマ ${version} (${allowed.size} 個)`);

    for (const file of files) {
      const json = readJson(file);
      if (json.format_version !== declared) {
        problems.push(`${file}: format_version が他と違う (${json.format_version})`);
      }
      const components = json[key]?.components ?? {};
      for (const name of Object.keys(components)) {
        if (name.startsWith("manytnt:")) continue; // 自作のカスタムコンポーネント
        if (!allowed.has(name)) {
          problems.push(`${file}: ${name} は ${family} ${version} のスキーマに無い`);
        }
      }
    }
  }

  return { skipped: false, root, used, problems: [...new Set(problems)] };
}
