#!/usr/bin/env node
// packs/BP と packs/RP を 1つの .mcaddon (BP/ と RP/ を含む ZIP) にまとめる。
//   node tools/build.mjs            → dist/many_tnt_addon.mcaddon と、ルートの配布用ファイルを更新
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createZip } from "./lib/zip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const entries = [];
for (const pack of ["BP", "RP"]) {
  const base = join(ROOT, "packs", pack);
  for (const file of walk(base)) {
    entries.push({ name: `${pack}/${relative(base, file).split(sep).join("/")}`, data: readFileSync(file) });
  }
}
const zip = createZip(entries);
mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist/many_tnt_addon.mcaddon"), zip);
writeFileSync(join(ROOT, "many_tnt_addon.mcaddon"), zip);
console.log(`built many_tnt_addon.mcaddon: ${entries.length} files, ${(zip.length / 1024).toFixed(1)} KiB`);
