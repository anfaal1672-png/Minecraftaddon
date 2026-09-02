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
import { canvas, shade, mix, isLight, noise } from "./lib/png.mjs";
import { EMBLEMS, assertEmblems } from "./lib/emblems.mjs";
import { PALETTES, RAINBOW_ROWS, BOTTOM } from "./lib/palettes.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "RP/textures/blocks");

/* ------------------------------------------------------------------ */
/*  16x16 の断面。バニラのTNTと同じ構成にする。                          */
/*                                                                     */
/*  バニラのTNTは木箱ではないので、板の継ぎ目のような縦線は入らない。     */
/*  一様な地の色に細かい斑点が散っているだけの面で、中央に細い帯があり、  */
/*  帯の上下だけが1ドットの暗い線で区切られている。                      */
/*                                                                     */
/*    0 - 4    本体 (斑点)                                              */
/*    5        帯の上のふち                                             */
/*    6 - 9    帯 … ここに 4行×12列 の紋章を描く                        */
/*    10       帯の下のふち                                             */
/*    11 - 15  本体 (斑点)                                              */
/* ------------------------------------------------------------------ */
const BAND_TOP = 6;
const BAND_BOTTOM = 9;
const BAND_LEFT = 2;

/** body 一色から、斑点・帯・紋章の色を組み立てる */
function buildPalette(spec) {
  const body = spec.crate;
  const band = spec.band ?? mix("#f0eade", body, 0.10);
  const ink = spec.ink ?? (isLight(band) ? shade(body, -0.6) : shade(body, 0.66));
  return {
    body,
    bodyLight: shade(body, 0.11),
    bodySpeck: shade(body, -0.10),
    bodyDark: shade(body, -0.21),
    band,
    bandEdge: shade(band, -0.45),
    ink,
    inkLight: shade(ink, 0.45),
    inkDark: shade(ink, -0.38),
    style: spec.style,
  };
}

/** 本体の1ピクセル。バニラと同じく、規則的な線ではなく細かい斑点で質感を出す */
function bodyPixel(x, y, pal) {
  const base = pal.style === "rainbow"
    ? RAINBOW_ROWS[Math.min(RAINBOW_ROWS.length - 1, Math.floor((y < 6 ? y : y - 5) / 2))]
    : null;
  const n = noise(x, y);
  if (base) {
    if (n < 0.16) return shade(base, -0.26);
    if (n < 0.30) return shade(base, 0.16);
    return base;
  }
  if (n < 0.10) return pal.bodyDark;
  if (n < 0.28) return pal.bodySpeck;
  if (n < 0.40) return pal.bodyLight;
  return pal.body;
}

function drawSide(pal, emblem) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y === BAND_TOP - 1 || y === BAND_BOTTOM + 1) c.put(x, y, pal.bandEdge);
      else if (y >= BAND_TOP && y <= BAND_BOTTOM) {
        // 帯はごくわずかに上が明るく、下が沈む
        c.put(x, y, y === BAND_TOP ? shade(pal.band, 0.08) : y === BAND_BOTTOM ? shade(pal.band, -0.07) : pal.band);
      } else c.put(x, y, bodyPixel(x, y, pal));
    }
  }
  // 帯の上に紋章を重ねる
  const inkOf = { X: pal.ink, o: pal.inkLight, "#": pal.inkDark };
  EMBLEMS[emblem].forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = inkOf[ch];
      if (color) c.put(BAND_LEFT + rx, BAND_TOP + ry, color);
    });
  });
  return c;
}

/**
 * 上面・底面。バニラのTNTの上下面と同じく、帯も文字も無い斑点だけの一枚面。
 * 種類は本体の色で見分ける。
 */
function drawTop(pal) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // 上下面は側面よりわずかに沈ませて、面の向きの差を出す
      let col = shade(bodyPixel(x, y, pal), -0.06);
      if (x === 0 || y === 0 || x === 15 || y === 15) col = shade(col, -0.16);
      c.put(x, y, col);
    }
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
  fs.writeFileSync(path.join(outDir, `${type}_top.png`), drawTop(pal).toPng());
  written += 2;

  if (preview) {
    console.log(`\n── ${type} (${spec.emblem}) ──`);
    const rows = EMBLEMS[spec.emblem];
    const glyph = { ".": "·", X: "█", o: "▓", "#": "▒" };
    console.log("  本体 " + pal.body + " / 帯 " + pal.band + " / 紋章 " + pal.ink);
    for (const r of rows) console.log("    " + [...r].map((ch) => glyph[ch]).join(""));
  }
}

// 底面は全種共通
if (!only) {
  fs.writeFileSync(path.join(outDir, "tnt_bottom.png"), drawTop(buildPalette(BOTTOM)).toPng());
  written++;
}

console.log(`✅ テクスチャ ${written} 枚を書き出した (${path.relative(root, outDir)})`);
