/**
 * 核兵器カテゴリのTNT。
 *
 * 核兵器とその先。このアドオンの最大火力。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "nuke_tnt",
    name: { ja: "核TNT", en: "Nuke TNT" },
    desc: { ja: "きのこ雲・熱線・残留放射能を伴う、核兵器の入口。", en: "The entry level nuke: mushroom cloud, heat flash, fallout." },
    fuse: 100,
    blast: { power: 20, breaks: true, fire: true, underwater: true },
    visual: { color: "#d4af1c", emblem: "radiation", trail: "minecraft:basic_flame_particle" },
    effect: "nukeEffect",
    recipe: { ingredients: ["manytnt:mega_tnt", "minecraft:glowstone"] },
  },
  {
    id: "ultra_nuke_tnt",
    name: { ja: "超核TNT", en: "Ultra Nuke TNT" },
    desc: { ja: "核TNTの上位。半径36の球がまるごと消し飛ぶ。", en: "A bigger nuke; a sphere of radius 36 simply ceases to be." },
    fuse: 110,
    blast: { power: 35, breaks: true, fire: true, underwater: true },
    visual: { color: "#e07a14", emblem: "mushroom", trail: "minecraft:basic_flame_particle" },
    effect: "ultraNukeEffect",
    recipe: { ingredients: ["manytnt:nuke_tnt", "minecraft:blaze_powder", "minecraft:blaze_powder"] },
  },
  {
    id: "hydrogen_bomb_tnt",
    name: { ja: "水素爆弾", en: "Hydrogen Bomb" },
    desc: { ja: "核融合の一撃。半径50の地形が丸ごと作り替わる。", en: "Fusion scale. Radius 50 of terrain is remade." },
    fuse: 120,
    blast: { power: 50, breaks: true, fire: true, underwater: true },
    visual: { color: "#7c3fb4", emblem: "mushroom_ring", trail: "minecraft:basic_flame_particle" },
    effect: "hydrogenBombEffect",
    recipe: { ingredients: ["manytnt:ultra_nuke_tnt", "minecraft:diamond", "minecraft:diamond"] },
  },
  {
    id: "tsar_bomba_tnt",
    name: { ja: "ツァーリボンバ", en: "Tsar Bomba" },
    desc: { ja: "史上最大の核実験を再現した一撃。半径66。", en: "A recreation of the largest nuclear test ever. Radius 66." },
    fuse: 140,
    blast: { power: 65, breaks: true, fire: true, underwater: true },
    visual: { color: "#c01a5c", emblem: "bomb", trail: "minecraft:basic_flame_particle" },
    effect: "tsarBombaEffect",
    recipe: { ingredients: ["manytnt:hydrogen_bomb_tnt", "minecraft:netherite_ingot"] },
  },
  {
    id: "antimatter_tnt",
    name: { ja: "反物質爆弾", en: "Antimatter Bomb" },
    desc: { ja: "対消滅。このアドオン最大の破壊半径80を誇る。", en: "Annihilation. The addon's largest blast, radius 80." },
    fuse: 160,
    blast: { power: 80, breaks: true, fire: true, underwater: true },
    visual: { color: "#2c2450", band: "#1b1730", emblem: "atom", trail: "minecraft:endrod" },
    effect: "antimatterEffect",
    recipe: {
      ingredients: [
        "manytnt:tsar_bomba_tnt",
        "minecraft:netherite_ingot",
        "minecraft:nether_star",
        "minecraft:amethyst_shard",
      ],
    },
  },
  {
    id: "armageddon_tnt",
    name: { ja: "終焉TNT", en: "Armageddon TNT" },
    desc: { ja: "核級の爆発に加え、ランダムな効果を連続で叩き込む。", en: "A nuclear blast chased by a chain of random effects." },
    fuse: 140,
    blast: { power: 40, breaks: true, fire: true, underwater: true },
    visual: {
      color: "#2c0c0c", band: "#1c0a0a", emblem: "bigskull", trail: "minecraft:huge_explosion_emitter",
    },
    effect: "armageddonEffect",
    recipe: {
      ingredients: [
        "manytnt:tsar_bomba_tnt",
        "manytnt:hydrogen_bomb_tnt",
        "manytnt:ultra_nuke_tnt",
        "manytnt:nuke_tnt",
        "minecraft:nether_star",
      ],
    },
  },
];
