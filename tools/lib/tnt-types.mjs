/**
 * main.js の TNT_TABLE に並んでいる順で種類名を返す。
 *
 * 起爆中のエンティティは、テクスチャを「何番目の種類か」という数値
 * (エンティティプロパティ manytnt:kind) で選ぶ。その番号は main.js 側の
 * 並び順そのものなので、テクスチャの一覧を作るときも同じ順を使う必要がある。
 * 両方がここを見ることで、並びがずれないようにしてある。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function tntTypesInOrder() {
  const src = fs.readFileSync(path.join(root, "BP/scripts/main.js"), "utf8");
  const table = src.match(/const TNT_TABLE = \{([\s\S]*?)\n\};/);
  if (!table) throw new Error("main.js から TNT_TABLE を読み取れなかった");
  return [...table[1].matchAll(/\[`\$\{NS\}:(\w+)`\]/g)].map((m) => m[1]);
}
