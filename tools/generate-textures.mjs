/**
 * TNTのブロックテクスチャを生成する。
 *   実行: node tools/generate-textures.mjs
 *
 * バニラのTNTと同じ「木箱 + 中央の帯」という作りを土台に、
 * 種類ごとに木箱の色を変え、帯には見分けのつく紋章を描く。
 * 生成先は RP/textures/blocks/<種類>_top.png と _side.png、
 * それに全種共通の tnt_bottom.png。
 *
 * 描いた絵を目で確かめたいときは --preview を付けると
 * 端末に文字で並べて表示する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canvas, shade, mix, isLight } from "./lib/png.mjs";
import { EMBLEMS, assertEmblems } from "./lib/emblems.mjs";
import { PALETTES, RAINBOW_ROWS, BOTTOM } from "./lib/palettes.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "RP/textures/blocks");

/* ------------------------------------------------------------------ */
/*  木箱の断面。バニラのTNTと同じ「上下が板・中央が帯」の構成にする      */
/*                                                                     */
/*    0        枠 (いちばん暗い)                                        */
/*    1 - 3    板                                                       */
/*    4        帯のふち                                                 */
/*    5 - 10   帯 … ここに 6行×12列 の紋章を描く                        */
/*    11       帯のふち                                                 */
/*    12 - 14  板                                                       */
/*    15       枠                                                       */
/* ------------------------------------------------------------------ */
const BAND_TOP = 5;
const BAND_LEFT = 2;

/** crate 一色から、影・ハイライト・帯・紋章の色を組み立てる */
function buildPalette(spec) {
  const crate = spec.crate;
  const band = spec.band ?? mix("#f2ece0", crate, 0.14);
  const ink = spec.ink ?? (isLight(band) ? shade(crate, -0.55) : shade(crate, 0.62));
  return {
    crate,
    crateLight: shade(crate, 0.18),
    crateGrain: shade(crate, -0.14),
    crateDark: shade(crate, -0.32),
    edge: shade(crate, -0.52),
    band,
    bandShade: shade(band, -0.12),
    bandEdge: shade(band, -0.42),
    ink,
    inkLight: shade(ink, 0.45),
    inkDark: shade(ink, -0.38),
    style: spec.style,
  };
}

/** 板の1ピクセル。縦の継ぎ目とハイライト、それに軽い木目を入れる */
function cratePixel(x, y, pal) {
  const base = pal.style === "rainbow" ? RAINBOW_ROWS[y % RAINBOW_ROWS.length] : null;
  if (base) {
    if (x === 3 || x === 7 || x === 11 || x === 15) return shade(base, -0.3);
    if (x === 0 || x === 4 || x === 8 || x === 12) return shade(base, 0.18);
    return base;
  }
  if (x === 3 || x === 7 || x === 11 || x === 15) return pal.crateDark;
  if (x === 0 || x === 4 || x === 8 || x === 12) return pal.crateLight;
  if ((x * 7 + y * 5) % 9 === 0) return pal.crateGrain;
  return pal.crate;
}

function drawSide(pal, emblem) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y === 0 || y === 15) c.put(x, y, pal.edge);
      else if (y === 4 || y === 11) c.put(x, y, pal.bandEdge);
      else if (y >= BAND_TOP && y <= 10) c.put(x, y, y === BAND_TOP ? pal.band : pal.bandShade);
      else c.put(x, y, cratePixel(x, y, pal));
    }
  }
  // 帯の上に紋章を重ねる
  const rows = EMBLEMS[emblem];
  const inkOf = { X: pal.ink, o: pal.inkLight, "#": pal.inkDark };
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = inkOf[ch];
      if (color) c.put(BAND_LEFT + rx, BAND_TOP + ry, color);
    });
  });
  return c;
}

/** 上面/底面。3×3 の木枠に、中央だけ紋章色を置いて上からでも種類がわかるようにする */
function drawLid(pal, { marker = true } = {}) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (x % 5 === 0 || y % 5 === 0) {
        c.put(x, y, pal.edge);
        continue;
      }
      const cx = x % 5;
      const cy = y % 5;
      let col = pal.style === "rainbow" ? RAINBOW_ROWS[(Math.floor(y / 5) * 2 + Math.floor(x / 5)) % RAINBOW_ROWS.length] : pal.crate;
      if (cx === 1 || cy === 1) col = shade(col, 0.16);
      else if (cx === 4 || cy === 4) col = shade(col, -0.28);
      else if ((x * 7 + y * 5) % 9 === 0) col = shade(col, -0.12);
      c.put(x, y, col);
    }
  }
  if (marker) {
    for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) c.put(x, y, pal.ink);
    for (let y = 7; y <= 8; y++) for (let x = 7; x <= 8; x++) c.put(x, y, pal.inkLight);
  }
  return c;
}

/* ------------------------------------------------------------------ */
const emblemProblems = assertEmblems();
if (emblemProblems.length) {
  for (const p of emblemProblems) console.error(`  ❌ ${p}`);
  process.exit(1);
}

const preview = process.argv.includes("--preview");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

fs.mkdirSync(outDir, { recursive: true });
let written = 0;

for (const [type, spec] of Object.entries(PALETTES)) {
  if (only && type !== only) continue;
  if (!EMBLEMS[spec.emblem]) {
    console.error(`  ❌ ${type}: 紋章 "${spec.emblem}" が見つからない`);
    process.exit(1);
  }
  const pal = buildPalette(spec);
  fs.writeFileSync(path.join(outDir, `${type}_side.png`), drawSide(pal, spec.emblem).toPng());
  fs.writeFileSync(path.join(outDir, `${type}_top.png`), drawLid(pal).toPng());
  written += 2;

  if (preview) {
    console.log(`\n── ${type} (${spec.emblem}) ──`);
    const rows = EMBLEMS[spec.emblem];
    const glyph = { ".": "·", X: "█", o: "▓", "#": "▒" };
    console.log("  板 " + pal.crate + " / 帯 " + pal.band + " / 紋章 " + pal.ink);
    for (const r of rows) console.log("    " + [...r].map((ch) => glyph[ch]).join(""));
  }
}

// 底面は全種共通
if (!only) {
  fs.writeFileSync(path.join(outDir, "tnt_bottom.png"), drawLid(buildPalette(BOTTOM), { marker: false }).toPng());
  written++;
}

console.log(`✅ テクスチャ ${written} 枚を書き出した (${path.relative(root, outDir)})`);
