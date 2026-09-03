/**
 * ファイルの読み書き。生成器はどれもここを通す。
 *
 * 内容が変わっていないファイルは書き直さない。こうしておくと
 * 生成をかけ直しても git の差分に出ないので、
 * 「何を変えたのか」が毎回はっきりする。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** リポジトリ直下からの相対パスを絶対パスにする */
export const at = (rel) => path.join(ROOT, rel);

let written = 0;
let unchanged = 0;

/**
 * 下書きモード。
 * true にすると実際には書かず、「書くはずだったファイル」を控えるだけになる。
 * tools/check.mjs が「コミットされている生成物が古くないか」を見るのに使う。
 */
let dryRun = false;
const stale = [];

export function setDryRun(value) {
  dryRun = value;
  stale.length = 0;
}

/** 下書きモードで、内容が食い違ったファイルの一覧 */
export function staleFiles() {
  return [...stale];
}

/** 中身が変わったときだけ書く。書いたら true */
export function write(rel, text) {
  const file = at(rel);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current === text) {
    unchanged++;
    return false;
  }
  if (dryRun) {
    stale.push(rel);
    written++;
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  written++;
  return true;
}

/** JSON を決まった書式で書く */
export function writeJson(rel, value) {
  return write(rel, JSON.stringify(value, null, 2) + "\n");
}

/** バイナリ (テクスチャ) を、中身が変わったときだけ書く */
export function writeBinary(rel, buffer) {
  const file = at(rel);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buffer)) {
    unchanged++;
    return false;
  }
  if (dryRun) {
    stale.push(rel);
    written++;
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  written++;
  return true;
}

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(at(rel), "utf8"));
}

export function readText(rel) {
  return fs.readFileSync(at(rel), "utf8");
}

export function exists(rel) {
  return fs.existsSync(at(rel));
}

export function listFiles(rel, filter = () => true) {
  const dir = at(rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(filter).sort();
}

/**
 * そのフォルダから、今回作らなかったファイルを消す。
 * TNTを減らしたときに古いファイルが残り続けるのを防ぐ。
 */
export function pruneDir(rel, keep, filter = () => true) {
  const dir = at(rel);
  if (!fs.existsSync(dir)) return [];
  const removed = [];
  for (const name of fs.readdirSync(dir)) {
    if (!filter(name) || keep.has(name)) continue;
    if (!dryRun) fs.rmSync(path.join(dir, name), { force: true });
    removed.push(`${rel}/${name}`);
  }
  return removed;
}

export function stats() {
  return { written, unchanged };
}

export function resetStats() {
  written = 0;
  unchanged = 0;
}
