/**
 * 配布用の .mcaddon を作る。
 *   実行: node tools/pack.mjs
 *
 * .mcaddon は BP と RP をそのまま入れた zip。ここでは開発用のファイル
 * (テストや生成器) が混ざらないよう、BP/ と RP/ だけを詰める。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { at, readJson } from "./lib/io.mjs";

const OUTPUT = "many_tnt_addon.mcaddon";
const version = readJson("BP/manifest.json").header.version.join(".");

fs.rmSync(at(OUTPUT), { force: true });
execFileSync("zip", ["-r", "-q", "-X", OUTPUT, "BP", "RP"], { cwd: at("."), stdio: "inherit" });

const size = fs.statSync(at(OUTPUT)).size;
console.log(`✅ ${OUTPUT} を作った (v${version}, ${(size / 1024).toFixed(0)} KB)`);
