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
/*  16x16 の断面。                                                      */
/*                                                                     */
/*  作りは Mojang が公開しているバニラのリソースパック                    */
/*  (github.com/Mojang/bedrock-samples の resource_pack/textures/blocks/ */
/*  tnt_side.png・tnt_top.png・tnt_bottom.png) を読んで合わせてある。    */
/*  Mojang のファイル自体は "(c) Mojang AB. All rights reserved." で     */
/*  Minecraft EULA の対象なのでこのリポジトリには置かず、                */
/*  組み立て方だけを取り込んで、色と絵柄はここで作っている。              */
/*                                                                     */
/*  色は4段階 + 金具のグレー。tone の記号は下記のとおり。                 */
/*    a 最明   b 地   c 暗   d 最暗   g 金具   h 金具(暗)                */
/* ------------------------------------------------------------------ */

/*
 * 側面。本体は4列周期の縦縞で、行によって縞全体が1段ずつ明暗にずれる。
 *   0行目    … 1段明るい
 *   11・15行 … 1段暗い (帯の直下と下端の影)
 * 帯は 5〜10行の6ドット。文字が乗るのは内側の 6〜9行だけで、
 * 5行目は文字の無い白、10行目はひとつ沈んだ白。上下に暗い区切り線は入らない。
 */
const SIDE_STRIPE_DEFAULT = "bbcd";
const SIDE_STRIPE_BY_ROW = { 0: "aabc", 11: "ccdd", 15: "cccd" };
const BAND_TOP = 5;
const BAND_BOTTOM = 10;
const GLYPH_TOP = 6;
const GLYPH_LEFT = 2;

/* 上面・底面の 4×4 タイル。地の色に金具のグレーが四角く入る */
const TOP_TILE = ["baab", "aggc", "aggd", "ccdd"];
const BOTTOM_TILE = ["cbbc", "bggd", "bggd", "dddd"];

/*
 * 上面の中央にある導火線の差し込み口。X が黒い塊、o がまわりに散った煤。
 * バニラの絵をなぞったものではなく、同じ雰囲気になるよう引き直したもの。
 */
const TOP_BURST = [
  "................",
  "................",
  ".......oo.oo....",
  "....o.XX...o....",
  "...o.XXXXX.oo...",
  "...oXXXXXXXo....",
  "..o.XXXX.XXXo...",
  "...XXXXXXXXXXo..",
  "..oXXXXXXXXX.o..",
  "...oXXXX.XXXo...",
  "...o.XXXXXX.o...",
  "....oX.XX.oo....",
  ".....o.oo.o.....",
  "................",
  "................",
  "................",
];

/** body 一色から、縞・金具・帯・紋章の色を組み立てる */
function buildPalette(spec) {
  const body = spec.crate;
  const band = spec.band ?? mix("#dedbd9", body, 0.05);
  // バニラのTNTの文字は黒ではなく濃紺。種類ごとの色味は残しつつ、
  // その紺に寄せて落ち着かせる
  const ink = spec.ink ?? (isLight(band)
    ? mix(shade(body, -0.66), "#25243f", 0.72)
    : shade(body, 0.68));
  return {
    tone: {
      a: shade(body, 0.10),
      b: body,
      c: shade(body, -0.24),
      d: shade(body, -0.35),
      g: mix("#8e8e8e", body, 0.12),
      h: mix("#565656", body, 0.10),
    },
    burst: mix("#11111e", body, 0.15),
    soot: mix("#565656", body, 0.10),
    band,
    bandHigh: shade(band, 0.10),
    bandMid: shade(band, -0.06),
    bandLow: shade(band, -0.14),
    ink,
    inkLight: shade(ink, 0.45),
    inkDark: shade(ink, -0.38),
    style: spec.style,
  };
}

/** 虹TNTだけは本体の縞を虹色にする */
function bodyTone(pal, key, y) {
  if (pal.style !== "rainbow") return pal.tone[key];
  const base = RAINBOW_ROWS[Math.min(RAINBOW_ROWS.length - 1, Math.floor((y < 5 ? y : y - 5) / 2))];
  const step = { a: 0.10, b: 0, c: -0.24, d: -0.35, g: -0.5, h: -0.62 }[key];
  return shade(base, step);
}

function drawSide(pal, emblem) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    if (y >= BAND_TOP && y <= BAND_BOTTOM) {
      for (let x = 0; x < 16; x++) {
        if (y === BAND_BOTTOM) {
          c.put(x, y, pal.bandLow);
          continue;
        }
        // いちばん明るい白は左右の端だけ。バニラも帯の内側には白を置かず、
        // 2段階の淡いグレーだけで濃淡を作っている
        if ((x === 0 || x === 15) && y !== BAND_TOP + 2) {
          c.put(x, y, pal.bandHigh);
          continue;
        }
        c.put(x, y, noise(x, y, 11) < 0.45 ? pal.bandMid : pal.band);
      }
      continue;
    }
    const stripe = SIDE_STRIPE_BY_ROW[y] ?? SIDE_STRIPE_DEFAULT;
    for (let x = 0; x < 16; x++) c.put(x, y, bodyTone(pal, stripe[x % 4], y));
  }

  // 帯の内側4行に紋章を重ねる。バニラの文字も一色ではなく
  // ところどころ暗い点が混ざっているので、それも真似ておく
  const inkOf = { X: pal.ink, o: pal.inkLight, "#": pal.inkDark };
  EMBLEMS[emblem].forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      let color = inkOf[ch];
      if (!color) return;
      if (ch === "X" && noise(rx, ry, 23) < 0.28) color = pal.inkDark;
      c.put(GLYPH_LEFT + rx, GLYPH_TOP + ry, color);
    });
  });
  return c;
}

/** 上面・底面 */
function drawFace(pal, tile, { burst = false } = {}) {
  const c = canvas(16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      c.put(x, y, bodyTone(pal, tile[y % 4][x % 4], y));
    }
  }
  if (burst) {
    TOP_BURST.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "X") c.put(x, y, pal.burst);
        else if (ch === "o") c.put(x, y, pal.soot);
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
  fs.writeFileSync(path.join(outDir, `${type}_top.png`), drawFace(pal, TOP_TILE, { burst: true }).toPng());
  written += 2;

  if (preview) {
    console.log(`\n── ${type} (${spec.emblem}) ──`);
    const rows = EMBLEMS[spec.emblem];
    const glyph = { ".": "·", X: "█", o: "▓", "#": "▒" };
    console.log("  本体 " + pal.tone.b + " / 帯 " + pal.band + " / 紋章 " + pal.ink);
    for (const r of rows) console.log("    " + [...r].map((ch) => glyph[ch]).join(""));
  }
}

// 底面は全種共通
if (!only) {
  fs.writeFileSync(path.join(outDir, "tnt_bottom.png"), drawFace(buildPalette(BOTTOM), BOTTOM_TILE).toPng());
  written++;
}

console.log(`✅ テクスチャ ${written} 枚を書き出した (${path.relative(root, outDir)})`);
