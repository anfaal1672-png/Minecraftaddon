/**
 * テクスチャを生成する。
 *
 * バニラのTNTのテクスチャを土台にして、色を種類ごとに差し替え、
 * 帯の "TNT" の文字だけをそのTNTの紋章に置き換える。
 * 縞の周期・帯のムラ・上面の煤の散り方といった細部は実物そのままなので、
 * 並べても違和感が出ない。
 *
 * 土台にするテクスチャは Mojang の配布物で、ライセンス上このリポジトリには
 * 置けない。手元に clone してから実行すること (見つからないときに出る
 * メッセージに手順が書いてある)。
 *
 * 生成先:
 *   RP/textures/blocks/<種類>_{side,top}.png と共通の tnt_bottom.png
 *   RP/textures/entity/tnt/<種類>.png        起爆中のエンティティ用
 *   RP/textures/items/catalog.png            図鑑アイテムの絵
 */
import { TNT_BY_ID, TNT_IDS } from "../../data/index.mjs";
import { GEAR_BLOCKS, GEAR_ITEMS } from "../../data/gear.mjs";
import { canvas, isLight, mix, shade } from "../lib/png.mjs";
import { assertEmblems, EMBLEMS } from "../lib/emblems.mjs";
import { BOTTOM, RAINBOW_ROWS } from "../lib/style.mjs";
import { GLYPH_ROLES, loadVanillaTnt, NOT_FOUND_MESSAGE } from "../lib/vanilla.mjs";
import { writeBinary } from "../lib/io.mjs";

/*
 * 紋章を描く範囲 (10行×14列)。バニラの "TNT" は帯の内側4行に収まっているが、
 * 72種類を見分けるにはそれでは小さすぎるので、帯 (5〜10行) を越えて
 * 本体の上まで使う。はみ出した部分は縞の上に乗って読みにくくなるため、
 * そこだけ1ドットの縁取りを付ける。
 */
export const GLYPH_TOP = 3;
export const GLYPH_LEFT = 1;
export const BAND_TOP = 5;
export const BAND_BOTTOM = 10;

/** 本体の赤4段階にあたる役割と、地の色からの明暗の差 */
export const BODY_STEPS = { bright: 0.1, body: 0, crimson: -0.24, dark: -0.35 };

/** 地の色ひとつから、バニラの13色それぞれに対応する色を作る */
export function buildPalette(visual) {
  const body = visual.color;
  const band = visual.band ?? mix("#dedbd9", body, 0.05);
  // バニラのTNTの文字は黒ではなく濃紺。種類ごとの色味は残しつつ、その紺に寄せる
  const ink = visual.ink ?? (isLight(band)
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
    style: visual.style,
  };
}

/** 役割ひとつを実際の色にする。虹TNTだけは本体の4段階を虹色に差し替える */
function colorFor(palette, role, y) {
  if (palette.style === "rainbow" && role in BODY_STEPS) {
    const base = RAINBOW_ROWS[Math.min(RAINBOW_ROWS.length - 1, Math.floor((y < 5 ? y : y - 5) / 2))];
    return shade(base, BODY_STEPS[role]);
  }
  return palette[role];
}

/** 役割の二次元配列を、そのTNTの色で塗り直す */
export function paint(roleGrid, palette, { blankGlyph = false } = {}) {
  const c = canvas(16);
  roleGrid.forEach((row, y) => {
    row.forEach((role, x) => {
      if (!role) return;
      // 側面はここで文字を消しておき、あとから紋章を描く
      if (blankGlyph && GLYPH_ROLES.has(role)) {
        c.put(x, y, palette.band);
        return;
      }
      c.put(x, y, colorFor(palette, role, y));
    });
  });
  return c;
}

/** 紋章を描く。帯からはみ出した部分には縁取りを付ける */
export function drawGlyph(c, palette, emblem) {
  const rows = EMBLEMS[emblem];
  const inkOf = { X: palette.ink, o: palette.inkLight, "#": palette.inkDark };

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
      c.put(nx, ny, palette.glyphOutline);
    }
  }

  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = inkOf[ch];
      if (!color) return;
      // バニラの文字も一色ではなく、ところどころ濃い点が混ざっている
      const shaded = ch === "X" && (rx * 7 + ry * 5) % 9 < 2 ? palette.inkDark : color;
      c.put(GLYPH_LEFT + rx, GLYPH_TOP + ry, shaded);
    });
  });
}

/*
 * 起爆中のエンティティ用のテクスチャ。
 *
 * ブロックは面ごとに別ファイルでよいが、エンティティのモデルは
 * 1枚の画像から UV で切り出すので、6面ぶんを 64×32 に並べた1枚にまとめる。
 * 並びは tools/gen/entity.mjs の UV 指定と対になっている。
 *
 *     (0,0)          (16,0)         (32,0)         (48,0)
 *       .            上面           底面             .
 *     (0,16)         (16,16)        (32,16)        (48,16)
 *      西面           北面           東面           南面
 */
export function buildEntityAtlas(side, top, bottom) {
  const atlas = canvas(64, 32);
  atlas.blit(top, 16, 0);
  atlas.blit(bottom, 32, 0);
  for (const x of [0, 16, 32, 48]) atlas.blit(side, x, 16);
  return atlas;
}

/**
 * 道具と投擲爆弾のアイコン (16×16)。
 *
 * ブロックと違ってバニラのテクスチャを土台にできないので、
 * 色の付いた角丸の板に紋章を載せる形で直接描く。
 * 紋章はTNTと共通なので、持ち物の中でも同じ絵柄で見分けがつく。
 */
export function itemIcon(visual) {
  const c = canvas(16);
  const palette = buildPalette(visual);
  for (let y = 1; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      // 四隅を落として角丸にする
      const corner = (x <= 2 || x >= 13) && (y <= 2 || y >= 13);
      if (corner && (x + y) % 2 === 0 && (x <= 1 || x >= 14 || y <= 1 || y >= 14)) continue;
      if ((x === 1 || x === 14) && (y === 1 || y === 14)) continue;
      let color = palette.body;
      if (y <= 2) color = palette.bright;
      else if (y >= 12) color = palette.dark;
      else if (x === 1 || x === 14) color = palette.crimson;
      c.put(x, y, color);
    }
  }
  drawGlyph(c, palette, visual.emblem);
  return c;
}


/**
 * 全テクスチャを書き出す。
 * @param only 1種類だけ作り直したいときに id を渡す
 */
export function generateTextures({ only = null } = {}) {
  const problems = assertEmblems();
  if (problems.length) throw new Error(`紋章の形がおかしい:\n  ${problems.join("\n  ")}`);

  const vanilla = loadVanillaTnt();
  if (!vanilla) throw new Error(NOT_FOUND_MESSAGE);
  if (vanilla.unknown.length) {
    throw new Error(
      `役割の分からない色がバニラのテクスチャにある: ${vanilla.unknown.join(", ")}\n` +
      "tools/lib/vanilla.mjs の ROLE_OF_COLOR に追記が必要"
    );
  }

  const bottomFace = paint(vanilla.faces.bottom, buildPalette(BOTTOM));
  let count = 0;

  for (const id of TNT_IDS) {
    if (only && id !== only) continue;
    const def = TNT_BY_ID.get(id);
    if (!EMBLEMS[def.visual.emblem]) {
      throw new Error(`${id}: 紋章 "${def.visual.emblem}" が見つからない`);
    }
    const palette = buildPalette(def.visual);

    const side = paint(vanilla.faces.side, palette, { blankGlyph: true });
    drawGlyph(side, palette, def.visual.emblem);
    const top = paint(vanilla.faces.top, palette);

    if (writeBinary(`RP/textures/blocks/${id}_side.png`, side.toPng())) count++;
    if (writeBinary(`RP/textures/blocks/${id}_top.png`, top.toPng())) count++;
    if (writeBinary(`RP/textures/entity/tnt/${id}.png`, buildEntityAtlas(side, top, bottomFace).toPng())) count++;
  }

  if (!only) {
    // 底面は全種共通
    if (writeBinary("RP/textures/blocks/tnt_bottom.png", bottomFace.toPng())) count++;

    // 道具と投擲爆弾のアイコン
    for (const gear of GEAR_ITEMS) {
      if (writeBinary(`RP/textures/items/${gear.id}.png`, itemIcon(gear.visual).toPng())) count++;
    }

    // 仕掛けブロックは、TNTと同じ作りのテクスチャにする
    for (const block of GEAR_BLOCKS) {
      const palette = buildPalette(block.visual);
      const side = paint(vanilla.faces.side, palette, { blankGlyph: true });
      drawGlyph(side, palette, block.visual.emblem);
      const top = paint(vanilla.faces.top, palette);
      if (writeBinary(`RP/textures/blocks/${block.id}_side.png`, side.toPng())) count++;
      if (writeBinary(`RP/textures/blocks/${block.id}_top.png`, top.toPng())) count++;
    }
  }

  return { count, source: vanilla.dir };
}
