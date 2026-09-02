/**
 * TNTのブロックテクスチャを生成する。
 *   実行: node tools/generate-textures.mjs
 *
 * バニラのTNTのテクスチャを土台にして、色を種類ごとに差し替え、
 * 帯の "TNT" の文字だけをそのTNTの紋章に置き換える。
 * 縞の周期・帯のムラ・上面の煤の散り方といった細部は
 * 実物そのままなので、並べても違和感が出ない。
 *
 * 土台にするテクスチャは Mojang の配布物で、ライセンス上この
 * リポジトリには置けない。手元に clone してから実行すること
 * (見つからないときに出るメッセージに手順が書いてある)。
 *
 * 生成先: RP/textures/blocks/<種類>_{side,top}.png と共通の tnt_bottom.png
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canvas, shade, mix, isLight } from "./lib/png.mjs";
import { EMBLEMS, assertEmblems } from "./lib/emblems.mjs";
import { PALETTES, RAINBOW_ROWS, BOTTOM } from "./lib/palettes.mjs";
import { loadVanillaTnt, GLYPH_ROLES, NOT_FOUND_MESSAGE } from "./lib/vanilla.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "RP/textures/blocks");

/* 帯に文字が乗る範囲。バニラの "TNT" が置かれているのと同じ位置 */
const GLYPH_TOP = 6;
const GLYPH_LEFT = 2;

/* 本体の赤4段階にあたる役割と、地の色からの明暗の差 */
const BODY_STEPS = { bright: 0.1, body: 0, crimson: -0.24, dark: -0.35 };

/** 地の色ひとつから、バニラの13色それぞれに対応する色を作る */
function buildPalette(spec) {
  const body = spec.crate;
  const band = spec.band ?? mix("#dedbd9", body, 0.05);
  // バニラのTNTの文字は黒ではなく濃紺。種類ごとの色味は残しつつ、その紺に寄せる
  const ink = spec.ink ?? (isLight(band)
    ? mix(shade(body, -0.66), "#25243f", 0.72)
    : shade(body, 0.68));
  return {
    bright: shade(body, BODY_STEPS.bright),
    body,
    crimson: shade(body, BODY_STEPS.crimson),
    dark: shade(body, BODY_STEPS.dark),
    // 金具のグレーと導火線口の黒は、バニラではほぼ無彩色。
    // 地の色を混ぜすぎると上面全体が濁るので、ほんの少しだけ寄せる
    metal: mix("#8e8e8e", body, 0.06),
    metalDark: mix("#565656", body, 0.06),
    burst: mix("#11111e", body, 0.07),
    bandHigh: shade(band, 0.12),
    band,
    bandMid: shade(band, -0.07),
    bandLow: shade(band, -0.15),
    ink,
    inkLight: shade(ink, 0.45),
    inkDark: shade(ink, -0.4),
    style: spec.style,
  };
}

/** 役割ひとつを実際の色にする。虹TNTだけは本体の4段階を虹色に差し替える */
function colorFor(pal, role, y) {
  if (pal.style === "rainbow" && role in BODY_STEPS) {
    const base = RAINBOW_ROWS[Math.min(RAINBOW_ROWS.length - 1, Math.floor((y < 5 ? y : y - 5) / 2))];
    return shade(base, BODY_STEPS[role]);
  }
  return pal[role];
}

/** 役割の二次元配列を、そのTNTの色で塗り直す */
function paint(roleGrid, pal, { blankGlyph = false } = {}) {
  const c = canvas(16);
  roleGrid.forEach((row, y) => {
    row.forEach((role, x) => {
      if (!role) return;
      // 側面はここで文字を消しておき、あとから紋章を描く
      if (blankGlyph && GLYPH_ROLES.has(role)) {
        c.put(x, y, pal.band);
        return;
      }
      c.put(x, y, colorFor(pal, role, y));
    });
  });
  return c;
}

/** 帯の上に紋章を描く */
function drawGlyph(c, pal, emblem) {
  const inkOf = { X: pal.ink, o: pal.inkLight, "#": pal.inkDark };
  EMBLEMS[emblem].forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = inkOf[ch];
      if (!color) return;
      // バニラの文字も一色ではなく、ところどころ濃い点が混ざっている
      const shaded = ch === "X" && (rx * 7 + ry * 5) % 9 < 2 ? pal.inkDark : color;
      c.put(GLYPH_LEFT + rx, GLYPH_TOP + ry, shaded);
    });
  });
}

/* ------------------------------------------------------------------ */
const emblemProblems = assertEmblems();
if (emblemProblems.length) {
  for (const p of emblemProblems) console.error(`  ❌ ${p}`);
  process.exit(1);
}

const vanilla = loadVanillaTnt();
if (!vanilla) {
  console.error(NOT_FOUND_MESSAGE);
  process.exit(1);
}
if (vanilla.unknown.length) {
  console.error(`  ❌ 役割の分からない色がバニラのテクスチャにある: ${vanilla.unknown.join(", ")}`);
  console.error("     tools/lib/vanilla.mjs の ROLE_OF_COLOR に追記が必要");
  process.exit(1);
}

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

  const side = paint(vanilla.faces.side, pal, { blankGlyph: true });
  drawGlyph(side, pal, spec.emblem);
  fs.writeFileSync(path.join(outDir, `${type}_side.png`), side.toPng());

  fs.writeFileSync(path.join(outDir, `${type}_top.png`), paint(vanilla.faces.top, pal).toPng());
  written += 2;
}

// 底面は全種共通
if (!only) {
  fs.writeFileSync(
    path.join(outDir, "tnt_bottom.png"),
    paint(vanilla.faces.bottom, buildPalette(BOTTOM)).toPng()
  );
  written++;
}

console.log(`✅ テクスチャ ${written} 枚を書き出した (${path.relative(root, outDir)})`);
console.log(`   土台: ${vanilla.dir}`);
