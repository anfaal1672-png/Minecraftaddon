/**
 * TNT定義の書式と、その検証。
 *
 * data/tnt/*.mjs に書く 1 件ぶんの形はこれ:
 *
 *   {
 *     id:     "mega_tnt",                        識別子。manytnt:<id> になる
 *     name:   { ja, en },                        表示名
 *     desc:   { ja, en },                        図鑑に出す一行説明
 *     fuse:   80,                                導火線の長さ (tick)。省略時 80
 *     blast:  { power, breaks, fire, underwater? },
 *     visual: { color, band?, ink?, style?, emblem, trail? },
 *     effect: "nukeEffect",                      爆発時に呼ぶ効果の名前 (省略可)
 *     traits: { launchUp?, gravityPull?, magnetPull?, gacha? },
 *     recipe: { ingredients: [...], count? },
 *   }
 *
 * ここでの検証は「生成物を作る前に落とす」ためのもの。書き間違いは
 * ゲーム内では静かに壊れるだけなので、必ずビルド時に弾いておく。
 */
export const HEX_COLOR = /^#[0-9a-f]{6}$/;
export const ID_PATTERN = /^[a-z][a-z0-9_]*_tnt$/;
export const ITEM_PATTERN = /^(minecraft|manytnt):[a-z0-9_]+$/;

/** 導火線の既定の長さ (tick)。バニラのTNTと同じ4秒 */
export const DEFAULT_FUSE = 80;

/** 導火線として認める範囲 (tick) */
export const FUSE_RANGE = [20, 200];

/** createExplosion に渡してよい威力の上限 */
export const MAX_POWER = 100;

/** レシピに置ける材料の数 (作業台は 3x3) */
export const MAX_INGREDIENTS = 9;

export const TRAIT_NAMES = ["launchUp", "gravityPull", "magnetPull", "gacha"];
export const VISUAL_STYLES = ["rainbow"];

function fail(errors, id, message) {
  errors.push(`${id}: ${message}`);
}

function checkText(errors, id, field, value) {
  if (!value || typeof value !== "object") return fail(errors, id, `${field} が無い`);
  for (const lang of ["ja", "en"]) {
    const s = value[lang];
    if (typeof s !== "string" || s.length === 0) fail(errors, id, `${field}.${lang} が空`);
  }
  const extra = Object.keys(value).filter((k) => k !== "ja" && k !== "en");
  if (extra.length) fail(errors, id, `${field} に知らない言語 ${extra.join(",")}`);
}

function checkKeys(errors, id, field, obj, allowed) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) fail(errors, id, `${field}.${k} は知らない項目`);
  }
}

/**
 * 1件を検証する。問題があればその説明を配列で返す。
 * @param {object} def 定義
 * @param {string[]} knownEmblems 使ってよい紋章の名前
 * @param {string[]} knownEffects 使ってよい効果の名前
 */
export function validateDef(def, { knownEmblems = null, knownEffects = null } = {}) {
  const errors = [];
  const id = def?.id ?? "(id無し)";

  if (typeof def !== "object" || def === null) return [`${id}: 定義がオブジェクトではない`];
  checkKeys(errors, id, "定義", def, [
    "id", "name", "desc", "fuse", "blast", "visual", "effect", "traits", "recipe",
    // 読み込み時に data/index.mjs が足すもの
    "category", "orderInCategory",
  ]);

  if (typeof def.id !== "string" || !ID_PATTERN.test(def.id)) {
    fail(errors, id, "id は小文字と _ だけで、_tnt で終わること");
  }

  checkText(errors, id, "name", def.name);
  checkText(errors, id, "desc", def.desc);

  const fuse = def.fuse ?? DEFAULT_FUSE;
  if (!Number.isInteger(fuse) || fuse < FUSE_RANGE[0] || fuse > FUSE_RANGE[1]) {
    fail(errors, id, `fuse は ${FUSE_RANGE[0]}〜${FUSE_RANGE[1]} の整数 (今は ${fuse})`);
  }
  if (fuse % 2 !== 0) fail(errors, id, "fuse は 2tick 単位にすること (0.1秒刻みで指定できないため)");

  const blast = def.blast;
  if (!blast || typeof blast !== "object") {
    fail(errors, id, "blast が無い");
  } else {
    checkKeys(errors, id, "blast", blast, ["power", "breaks", "fire", "underwater"]);
    if (!Number.isFinite(blast.power) || blast.power < 0 || blast.power > MAX_POWER) {
      fail(errors, id, `blast.power は 0〜${MAX_POWER} (今は ${blast.power})`);
    }
    for (const flag of ["breaks", "fire"]) {
      if (typeof blast[flag] !== "boolean") fail(errors, id, `blast.${flag} は true/false で必ず書くこと`);
    }
    if (blast.underwater !== undefined && typeof blast.underwater !== "boolean") {
      fail(errors, id, "blast.underwater は true/false");
    }
    if (blast.power === 0 && blast.breaks) fail(errors, id, "power 0 なのに breaks が true (何も起きない)");
  }

  const vis = def.visual;
  if (!vis || typeof vis !== "object") {
    fail(errors, id, "visual が無い");
  } else {
    checkKeys(errors, id, "visual", vis, ["color", "band", "ink", "style", "emblem", "trail"]);
    for (const key of ["color", "band", "ink"]) {
      const v = vis[key];
      if (v === undefined) {
        if (key === "color") fail(errors, id, "visual.color は必須");
        continue;
      }
      if (typeof v !== "string" || !HEX_COLOR.test(v)) fail(errors, id, `visual.${key} は #rrggbb の小文字 (今は ${v})`);
    }
    if (vis.style !== undefined && !VISUAL_STYLES.includes(vis.style)) {
      fail(errors, id, `visual.style は ${VISUAL_STYLES.join("/")} のいずれか`);
    }
    if (typeof vis.emblem !== "string" || vis.emblem.length === 0) fail(errors, id, "visual.emblem は必須");
    else if (knownEmblems && !knownEmblems.includes(vis.emblem)) fail(errors, id, `紋章 ${vis.emblem} が無い`);
    if (vis.trail !== undefined && !/^minecraft:[a-z0-9_]+$/.test(vis.trail)) {
      fail(errors, id, `visual.trail のパーティクル名がおかしい (${vis.trail})`);
    }
  }

  if (def.effect !== undefined && def.effect !== null) {
    if (typeof def.effect !== "string") fail(errors, id, "effect は関数名の文字列");
    else if (knownEffects && !knownEffects.includes(def.effect)) fail(errors, id, `効果 ${def.effect} が見つからない`);
  }

  if (def.traits !== undefined) {
    checkKeys(errors, id, "traits", def.traits, TRAIT_NAMES);
    for (const [k, v] of Object.entries(def.traits)) {
      if (v !== true) fail(errors, id, `traits.${k} は true のときだけ書くこと`);
    }
  }

  const recipe = def.recipe;
  if (!recipe || typeof recipe !== "object") {
    fail(errors, id, "recipe が無い");
  } else {
    checkKeys(errors, id, "recipe", recipe, ["ingredients", "count"]);
    const ing = recipe.ingredients;
    if (!Array.isArray(ing) || ing.length === 0) fail(errors, id, "recipe.ingredients が空");
    else {
      if (ing.length > MAX_INGREDIENTS) fail(errors, id, `材料が ${MAX_INGREDIENTS} 個を超えている`);
      for (const item of ing) {
        if (typeof item !== "string" || !ITEM_PATTERN.test(item)) fail(errors, id, `材料の書き方がおかしい (${item})`);
      }
    }
    if (recipe.count !== undefined && (!Number.isInteger(recipe.count) || recipe.count < 1 || recipe.count > 64)) {
      fail(errors, id, "recipe.count は 1〜64 の整数");
    }
  }

  return errors;
}

/**
 * 一覧全体を検証する。1件ごとの検証に加えて、
 * ID の重複や、材料に使った自作TNTが実在するかまで見る。
 */
export function validateAll(defs, options = {}) {
  const errors = [];
  const seen = new Set();
  const ids = new Set(defs.map((d) => d?.id));

  for (const def of defs) {
    errors.push(...validateDef(def, options));
    if (seen.has(def?.id)) errors.push(`${def.id}: id が重複している`);
    seen.add(def?.id);

    for (const item of def?.recipe?.ingredients ?? []) {
      if (typeof item === "string" && item.startsWith("manytnt:")) {
        const target = item.slice("manytnt:".length);
        if (!ids.has(target)) errors.push(`${def.id}: 材料 ${item} に対応するTNTが無い`);
        if (target === def.id) errors.push(`${def.id}: 自分自身を材料にしている`);
      }
    }
  }
  return errors;
}
