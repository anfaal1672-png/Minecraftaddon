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
import { RAINBOW_ROWS, BOTTOM } from "./lib/palettes.mjs";
import { TNT_IDS, TNT_BY_ID } from "../data/tnt-defs.mjs";
import { loadVanillaTnt, GLYPH_ROLES, NOT_FOUND_MESSAGE } from "./lib/vanilla.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "RP/textures/blocks");
const entityTexDir = path.join(root, "RP/textures/entity/tnt");

/*
 * 紋章を描く範囲 (10行×14列)。バニラの "TNT" は帯の内側 4行に収まっているが、
 * 67種類を見分けるにはそれでは小さすぎるので、帯 (5〜10行) を越えて
 * 本体の上まで使う。はみ出した部分は縞の上に乗って読みにくくなるため、
 * そこだけ 1ドットの縁取りを付ける。
 */
const GLYPH_TOP = 3;
const GLYPH_LEFT = 1;
const BAND_TOP = 5;
const BAND_BOTTOM = 10;

/* 本体の赤4段階にあたる役割と、地の色からの明暗の差 */
const BODY_STEPS = { bright: 0.1, body: 0, crimson: -0.24, dark: -0.35 };

/** 地の色ひとつから、バニラの13色それぞれに対応する色を作る */
function buildPalette(spec) {
  const body = spec.color;
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
    // 帯の外に出た紋章を縞から浮き立たせるための縁取り。
    // 明るい帯なら白寄り、暗い帯なら黒寄りにして、どちらでも輪郭が出るようにする
    glyphOutline: isLight(band) ? shade(band, 0.3) : shade(band, -0.5),
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

/** 紋章を描く。帯からはみ出した部分には縁取りを付ける */
function drawGlyph(c, pal, emblem) {
  const rows = EMBLEMS[emblem];
  const inkOf = { X: pal.ink, o: pal.inkLight, "#": pal.inkDark };

  const filled = new Set();
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (inkOf[ch]) filled.add(`${GLYPH_LEFT + rx},${GLYPH_TOP + ry}`);
    });
  });

  // 縁取り。帯の中は元々明暗の差があるので付けず、外に出た部分だけに付ける。
  // 斜めまで囲うと塊に見えてしまうので、上下左右の4方向だけにする
  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const key of filled) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= BAND_TOP && ny <= BAND_BOTTOM) continue;
      if (filled.has(`${nx},${ny}`)) continue;
      c.put(nx, ny, pal.glyphOutline);
    }
  }

  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = inkOf[ch];
      if (!color) return;
      // バニラの文字も一色ではなく、ところどころ濃い点が混ざっている
      const shaded = ch === "X" && (rx * 7 + ry * 5) % 9 < 2 ? pal.inkDark : color;
      c.put(GLYPH_LEFT + rx, GLYPH_TOP + ry, shaded);
    });
  });
}

/*
 * 起爆中のエンティティ用のテクスチャ。
 *
 * ブロックは面ごとに別ファイルでよいが、エンティティのモデルは
 * 1枚の画像から UV で切り出すので、6面ぶんを 64×32 に並べた1枚にまとめる。
 * 並びは RP/models/entity/primed_tnt.geo.json の UV 指定と対になっている。
 *
 *     (0,0)          (16,0)         (32,0)         (48,0)
 *       .            上面           底面             .
 *     (0,16)         (16,16)        (32,16)        (48,16)
 *      西面           北面           東面           南面
 */
function buildEntityAtlas(side, top, bottom) {
  const atlas = canvas(64, 32);
  atlas.blit(top, 16, 0);
  atlas.blit(bottom, 32, 0);
  for (const x of [0, 16, 32, 48]) atlas.blit(side, x, 16);
  return atlas;
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
fs.mkdirSync(entityTexDir, { recursive: true });

// 起爆中エンティティのテクスチャ選択は main.js の TNT_TABLE の並び順で行うので、
// 一覧もその順で作る
const order = TNT_IDS;

let written = 0;
const bottomFace = paint(vanilla.faces.bottom, buildPalette(BOTTOM));

for (const type of order) {
  if (only && type !== only) continue;
  const spec = TNT_BY_ID.get(type);
  if (!EMBLEMS[spec.emblem]) {
    console.error(`  ❌ ${type}: 紋章 "${spec.emblem}" が見つからない`);
    process.exit(1);
  }
  const pal = buildPalette(spec);

  const side = paint(vanilla.faces.side, pal, { blankGlyph: true });
  drawGlyph(side, pal, spec.emblem);
  const top = paint(vanilla.faces.top, pal);

  fs.writeFileSync(path.join(outDir, `${type}_side.png`), side.toPng());
  fs.writeFileSync(path.join(outDir, `${type}_top.png`), top.toPng());
  // 起爆中のエンティティは全面を1枚にまとめたものを使う
  fs.writeFileSync(path.join(entityTexDir, `${type}.png`), buildEntityAtlas(side, top, bottomFace).toPng());
  written += 3;
}

// 底面は全種共通
if (!only) {
  fs.writeFileSync(path.join(outDir, "tnt_bottom.png"), bottomFace.toPng());
  written++;

  // 起爆中エンティティの定義。テクスチャの並びが main.js と一致している
  // 必要があるので、手書きせずここから書き出す。
  const textures = Object.fromEntries(order.map((t) => [t, `textures/entity/tnt/${t}`]));
  fs.writeFileSync(
    path.join(root, "RP/entity/primed_tnt.entity.json"),
    JSON.stringify({
      format_version: "1.10.0",
      "minecraft:client_entity": {
        description: {
          identifier: "manytnt:primed_tnt",
          materials: { default: "entity_alphatest" },
          textures,
          geometry: { default: "geometry.manytnt_primed_tnt" },
          render_controllers: ["controller.render.manytnt_primed_tnt"],
        },
      },
    }, null, 2) + "\n"
  );

  fs.writeFileSync(
    path.join(root, "RP/render_controllers/primed_tnt.render_controllers.json"),
    JSON.stringify({
      format_version: "1.10.0",
      render_controllers: {
        "controller.render.manytnt_primed_tnt": {
          arrays: {
            textures: { "array.skins": order.map((t) => `Texture.${t}`) },
          },
          geometry: "Geometry.default",
          materials: [{ "*": "Material.default" }],
          textures: ["array.skins[query.property('manytnt:kind')]"],
          // 本物のTNTと同じように、導火線が燃えている間は白く明滅させる
          overlay_color: {
            r: 1.0,
            g: 1.0,
            b: 1.0,
            a: "math.mod(math.floor(query.life_time * 10.0), 2.0) * 0.55",
          },
        },
      },
    }, null, 2) + "\n"
  );
  written += 2;
}

console.log(`✅ ${written} ファイルを書き出した (ブロック・起爆中エンティティ・その定義)`);
console.log(`   土台: ${vanilla.dir}`);
