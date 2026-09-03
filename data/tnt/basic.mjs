/**
 * 基本カテゴリのTNT。
 *
 * 素直に爆発するだけの、土台になるTNT。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "mega_tnt",
    name: { ja: "メガTNT", en: "Mega TNT" },
    desc: { ja: "通常のTNTを4つ束ねた、素直に大きいだけの爆発。", en: "Four sticks bundled into one plain, oversized blast." },
    blast: { power: 14, breaks: true, fire: false },
    visual: { color: "#d4331c", emblem: "tnt" },
    recipe: { ingredients: ["minecraft:tnt", "minecraft:tnt", "minecraft:tnt", "minecraft:tnt"] },
  },
  {
    id: "mini_tnt",
    name: { ja: "ミニTNT", en: "Mini TNT" },
    desc: { ja: "手のひらサイズ。整地の微調整に使える小さな爆発。", en: "Palm sized. A small blast for fine terrain work." },
    fuse: 50,
    blast: { power: 2, breaks: true, fire: false },
    visual: { color: "#e0786a", emblem: "dynamite" },
    recipe: { ingredients: ["minecraft:tnt", "minecraft:string"], count: 2 },
  },
  {
    id: "rocket_tnt",
    name: { ja: "ロケットTNT", en: "Rocket TNT" },
    desc: { ja: "着火すると空へ打ち上がり、頂点で爆発する。", en: "Launches skyward when lit and bursts at the top." },
    fuse: 60,
    blast: { power: 6, breaks: true, fire: false },
    visual: { color: "#d22a2a", emblem: "rocket", trail: "minecraft:basic_flame_particle" },
    traits: { launchUp: true },
    recipe: { ingredients: ["minecraft:tnt", "minecraft:firework_rocket", "minecraft:feather"] },
  },
  {
    id: "gacha_tnt",
    name: { ja: "ガチャTNT", en: "Gacha TNT" },
    desc: { ja: "着火するまで何が出るか分からない、当たり付きのTNT。", en: "You never know what you lit until it goes off." },
    blast: { power: 2, breaks: true, fire: false },
    visual: { color: "#f24aa2", emblem: "star", trail: "minecraft:totem_particle" },
    traits: { gacha: true },
    recipe: { ingredients: ["minecraft:tnt", "minecraft:emerald", "minecraft:rabbit_foot"], count: 3 },
  },
];
