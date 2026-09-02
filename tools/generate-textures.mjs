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
/*  16x16 の断面。バニラのTNTの実物から構造を起こしてある。               */
/*                                                                     */
/*  側面 (バニラのTNTを分解して分かったこと):                            */
/*   ・本体は 4列周期の縦縞。左2列が地の色、3列目が暗く、4列目がさらに暗い */
/*   ・帯は 5〜10行 の 6ドット。上下に暗い区切り線は入らない              */
/*   ・文字が乗るのは帯の内側 6〜9行 の 4ドットだけで、5行目と10行目は    */
/*     文字の無い白のまま (10行目はわずかに沈む)                         */
/*   ・0行目は少し明るく、11行目と15行目は影で沈む                       */
/*                                                                     */
/*    0        本体 (やや明るい)                                        */
/*    1 - 4    本体                                                     */
/*    5        帯 (白のみ)                                              */
/*    6 - 9    帯 … ここに 4行×12列 の紋章を描く                        */
/*    10       帯 (わずかに沈む白)                                      */
/*    11       本体 (影)                                                */
/*    12 - 14  本体                                                     */
/*    15       本体 (影)                                                */
/* ------------------------------------------------------------------ */
const BAND_TOP = 5;
const BAND_BOTTOM = 10;
const GLYPH_TOP = 6;
const GLYPH_LEFT = 2;

/** body 一色から、縞・帯・紋章の色を組み立てる */
function buildPalette(spec) {
  const body = spec.crate;
  const band = spec.band ?? mix("#e9e4e0", body, 0.07);
  const ink = spec.ink ?? (isLight(band) ? shade(body, -0.62) : shade(body, 0.68));
  return {
    body,
    bodyDark: shade(body, -0.22),
    bodyDarker: shade(body, -0.38),
    // 上面の金具まわりのグレー。地の色をわずかに混ぜて浮かないようにする
    metal: mix("#8c8c8d", body, 0.14),
    metalDark: mix("#555555", body, 0.10),
    band,
    bandLow: shade(band, -0.09),
    ink,
    inkLight: shade(ink, 0.45),
    inkDark: shade(ink, -0.38),
    style: spec.style,
  };
}

/** 側面の本体。バニラと同じ 4列周期の縦縞 */
function sideBodyPixel(x, y, pal) {
  const base = pal.style === "rainbow"
    ? RAINBOW_ROWS[Math.min(RAINBOW_ROWS.length - 1, Math.floor((y < 5 ? y : y - 5) / 2))]
    : null;
  const m = x % 4;
  let c = base
    ? (m < 2 ? base : m === 2 ? shade(base, -0.22) : shade(base, -0.38))
    : (m < 2 ? pal.body : m === 2 ? pal.bodyDark : pal.bodyDarker);
  if (y === 0) c = shade(c, 0.09);
  else if (y === 11 || y === 15) c = shade(c, -0.14);
  return c;
}

function drawSide(pal, emblem) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (y >= BAND_TOP && y <= BAND_BOTTOM) {
        // 帯にもわずかな濃淡がある (バニラも真っ白一色ではない)
        const base = y === BAND_BOTTOM ? pal.bandLow : pal.band;
        c.put(x, y, noise(x, y, 7) < 0.3 ? shade(base, -0.05) : base);
      } else {
        c.put(x, y, sideBodyPixel(x, y, pal));
      }
    }
  }
  // 帯の内側 4行に紋章を重ねる
  const inkOf = { X: pal.ink, o: pal.inkLight, "#": pal.inkDark };
  EMBLEMS[emblem].forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = inkOf[ch];
      if (color) c.put(GLYPH_LEFT + rx, GLYPH_TOP + ry, color);
    });
  });
  return c;
}

/*
 * 上面の地模様。バニラのTNTの上面は 4×4 で繰り返す市松で、
 * 地の色と金具のグレーが混ざっている。
 *   a 地(明)  b 地  c 地(暗)  d 地(最暗)  g グレー  h グレー(暗)
 */
const TOP_TILE = [
  "cabb",
  "cggb",
  "dghb",
  "ddcg",
];

/*
 * 上面の中央にある黒い塊。導火線の差し込み口から放射状にひび割れている。
 * バニラの絵をなぞったものではなく、同じ雰囲気になるよう引き直したもの。
 */
const TOP_BURST = [
  "................",
  "................",
  "................",
  ".......X...X....",
  "....X...X.......",
  "......XXX.X.....",
  "....X.XXXXX.....",
  "...X.XXXXX.X....",
  ".....XXXXX.X....",
  "....X..XX.......",
  "...X...X..X.....",
  "......X....X....",
  "................",
  "................",
  "................",
  "................",
];

/** 上面・底面 */
function drawTop(pal, { burst = true } = {}) {
  const c = canvas(16);
  const tone = {
    a: shade(pal.body, 0.08),
    b: pal.body,
    c: pal.bodyDark,
    d: pal.bodyDarker,
    g: pal.metal,
    h: pal.metalDark,
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      c.put(x, y, tone[TOP_TILE[y % 4][x % 4]]);
    }
  }
  if (burst) {
    // 導火線口はどの色のTNTでも黒く落とす (帯の色に引きずられないように)
    const core = mix("#101018", pal.body, 0.22);
    TOP_BURST.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "X") c.put(x, y, core);
      });
    });
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
  fs.writeFileSync(path.join(outDir, "tnt_bottom.png"), drawTop(buildPalette(BOTTOM), { burst: false }).toPng());
  written++;
}

console.log(`✅ テクスチャ ${written} 枚を書き出した (${path.relative(root, outDir)})`);
