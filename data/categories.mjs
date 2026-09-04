/**
 * TNTのカテゴリ。ゲーム内の図鑑と、クリエイティブメニューの並びに使う。
 *
 * order の順にファイルを読み込むので、ここに書いた順序がそのまま
 * 起爆中エンティティの見た目の番号 (manytnt:kind) の順序にもなる。
 */
export const CATEGORIES = [
  { id: "basic",     name: { ja: "基本",   en: "Basic" },      icon: "§c●", file: "basic" },
  { id: "nuclear",   name: { ja: "核兵器", en: "Nuclear" },    icon: "§e☢", file: "nuclear" },
  { id: "elemental", name: { ja: "属性",   en: "Elemental" },  icon: "§b✦", file: "elemental" },
  { id: "motion",    name: { ja: "移動",   en: "Motion" },     icon: "§d✈", file: "motion" },
  { id: "creature",  name: { ja: "生物",   en: "Creature" },   icon: "§a❀", file: "creature" },
  { id: "terrain",   name: { ja: "地形",   en: "Terrain" },    icon: "§6▲", file: "terrain" },
  { id: "utility",   name: { ja: "便利",   en: "Utility" },    icon: "§f✚", file: "utility" },
  { id: "spectacle", name: { ja: "演出",   en: "Spectacle" },  icon: "§5✷", file: "spectacle" },
  { id: "construction", name: { ja: "建築", en: "Construction" }, icon: "§e▤", file: "construction" },
  { id: "military",  name: { ja: "兵器",   en: "Military" },   icon: "§8✦", file: "military" },
  { id: "cosmic",    name: { ja: "宇宙",   en: "Cosmic" },     icon: "§9✧", file: "cosmic" },
  { id: "chaos",     name: { ja: "災厄",   en: "Chaos" },      icon: "§4☠", file: "chaos" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
