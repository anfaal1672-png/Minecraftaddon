/**
 * 便利カテゴリのTNT。
 *
 * 回復・収集・照明など、役に立つTNT。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "heal_tnt",
    name: { ja: "回復TNT", en: "Heal TNT" },
    desc: { ja: "爆発ではなく、周囲を回復させる優しいTNT。", en: "Not a weapon: it heals everything around it." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#e85a7a", emblem: "heart", trail: "minecraft:heart_particle" },
    effect: "healEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:glistering_melon_slice"] },
  },
  {
    id: "web_tnt",
    name: { ja: "蜘蛛の巣TNT", en: "Web TNT" },
    desc: { ja: "一帯を蜘蛛の巣で埋め尽くす。", en: "Fills the whole area with cobwebs." },
    blast: { power: 2, breaks: false, fire: false },
    visual: { color: "#b4b4c0", emblem: "web" },
    effect: "webEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:string", "minecraft:string", "minecraft:string"] },
  },
  {
    id: "treasure_tnt",
    name: { ja: "お宝TNT", en: "Treasure TNT" },
    desc: { ja: "鉱石やお宝をばらまく。", en: "Showers the area with ores and treasure." },
    blast: { power: 3, breaks: true, fire: false },
    visual: { color: "#e0b22a", emblem: "gem", trail: "minecraft:villager_happy" },
    effect: "treasureEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:gold_ingot"] },
  },
  {
    id: "daynight_tnt",
    name: { ja: "時間TNT", en: "Day-Night TNT" },
    desc: { ja: "時間を昼か夜へ一気に飛ばす。", en: "Jumps the clock straight to day or night." },
    blast: { power: 2, breaks: false, fire: false },
    visual: { color: "#4c5c8c", emblem: "daynight", trail: "minecraft:endrod" },
    effect: "daynightEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:clock"] },
  },
  {
    id: "xp_tnt",
    name: { ja: "経験値TNT", en: "XP TNT" },
    desc: { ja: "大量の経験値をばらまく。", en: "Spills a huge amount of experience." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#6cd22a", emblem: "orb", trail: "minecraft:villager_happy" },
    effect: "xpEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:experience_bottle", "minecraft:experience_bottle"] },
  },
  {
    id: "fortune_tnt",
    name: { ja: "運試しTNT", en: "Fortune TNT" },
    desc: { ja: "当たりか外れか。良い効果か悪い効果が起きる。", en: "Win or lose: a good buff, or a bad one." },
    blast: { power: 2, breaks: true, fire: false },
    visual: { color: "#2ab25a", emblem: "clover", trail: "minecraft:totem_particle" },
    effect: "fortuneEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:rabbit_foot"] },
  },
  {
    id: "invisibility_tnt",
    name: { ja: "透明TNT", en: "Invisibility TNT" },
    desc: { ja: "範囲内のすべてを透明にする。", en: "Turns everything in range invisible." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#c6d0da", emblem: "ghost", trail: "minecraft:basic_smoke_particle" },
    effect: "invisibilityEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:glass", "minecraft:fermented_spider_eye"] },
  },
  {
    id: "feast_tnt",
    name: { ja: "満腹TNT", en: "Feast TNT" },
    desc: { ja: "食べ物をばらまき、満腹にする。", en: "Scatters food and fills everyone up." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#d29a4a", emblem: "cutlery", trail: "minecraft:heart_particle" },
    effect: "feastEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:bread", "minecraft:cooked_beef"] },
  },
  {
    id: "glow_tnt",
    name: { ja: "発光TNT", en: "Glow TNT" },
    desc: { ja: "一帯を照らし、生き物を発光させる。", en: "Lights the area and makes creatures glow." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#f2e272", emblem: "sun", trail: "minecraft:villager_happy" },
    effect: "glowEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:glowstone", "minecraft:glow_ink_sac"] },
  },
  {
    id: "vacuum_tnt",
    name: { ja: "真空TNT", en: "Vacuum TNT" },
    desc: { ja: "水と溶岩を吸い上げ、空気に変える。", en: "Drinks up water and lava, leaving only air." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#1c4c4c", emblem: "suction", trail: "minecraft:basic_bubble_particle" },
    effect: "vacuumEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:sponge", "minecraft:sponge"] },
  },
];
