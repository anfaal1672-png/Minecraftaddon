/**
 * 生物カテゴリのTNT。
 *
 * モブを呼び出すTNT。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "summon_tnt",
    name: { ja: "召喚TNT", en: "Summon TNT" },
    desc: { ja: "敵モブの群れを呼び出す。", en: "Summons a pack of hostile mobs." },
    blast: { power: 3, breaks: true, fire: false },
    visual: { color: "#3c6c3c", emblem: "creeper", trail: "minecraft:witchspell_emitter" },
    effect: "summonEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:rotten_flesh", "minecraft:bone"] },
  },
  {
    id: "ufo_tnt",
    name: { ja: "UFO襲来TNT", en: "UFO TNT" },
    desc: { ja: "上空にUFOが現れ、光線でモブをさらう。", en: "A UFO appears overhead and beams mobs away." },
    blast: { power: 2, breaks: false, fire: false },
    visual: { color: "#7c9c8c", emblem: "ufo", trail: "minecraft:witchspell_emitter" },
    effect: "ufoEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:emerald"] },
  },
  {
    id: "snowgolem_tnt",
    name: { ja: "雪だるまTNT", en: "Snow Golem TNT" },
    desc: { ja: "雪だるまの軍団を召喚する。", en: "Summons an army of snow golems." },
    blast: { power: 0, breaks: false, fire: false },
    visual: {
      color: "#e4eef4", band: "#4a6a84", ink: "#f6fcff", emblem: "snowman", trail: "minecraft:snowflake_particle",
    },
    effect: "snowgolemEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:carved_pumpkin", "minecraft:snowball"] },
  },
  {
    id: "bee_tnt",
    name: { ja: "ハチTNT", en: "Bee TNT" },
    desc: { ja: "怒ったハチの大群を放つ。", en: "Releases a swarm of angry bees." },
    blast: { power: 2, breaks: false, fire: false },
    visual: { color: "#e2b21a", emblem: "bee", trail: "minecraft:villager_happy" },
    effect: "beeEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:honeycomb", "minecraft:poppy"] },
  },
  {
    id: "slime_tnt",
    name: { ja: "スライムTNT", en: "Slime TNT" },
    desc: { ja: "スライムが跳ね回り、地面が粘つく。", en: "Bouncing slimes and sticky ground everywhere." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#7aca4a", emblem: "slime_face", trail: "minecraft:villager_happy" },
    effect: "slimeEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:slime_ball", "minecraft:slime_ball"] },
  },
  {
    id: "animal_tnt",
    name: { ja: "動物TNT", en: "Animal TNT" },
    desc: { ja: "動物の群れが飛び出す。", en: "A stampede of farm animals bursts out." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#b28a5a", emblem: "paw", trail: "minecraft:heart_particle" },
    effect: "animalEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:wheat", "minecraft:apple"] },
  },
  {
    id: "cat_tnt",
    name: { ja: "ネコTNT", en: "Cat TNT" },
    desc: { ja: "ネコが大量に現れる。クリーパーが寄り付かなくなる。", en: "Cats everywhere. Creepers will not come near." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#d8a860", emblem: "cat", trail: "minecraft:heart_particle" },
    effect: "catEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:cod", "minecraft:string"] },
  },
  {
    id: "villager_tnt",
    name: { ja: "村人TNT", en: "Villager TNT" },
    desc: { ja: "村人と取引台がまとめて現れる。即席の村ができる。", en: "Villagers and workstations appear together. An instant village." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#8c6c4a", emblem: "villager", trail: "minecraft:villager_happy" },
    effect: "villagerEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:emerald", "minecraft:bed", "minecraft:bell"] },
  },
  {
    id: "golem_tnt",
    name: { ja: "ゴーレムTNT", en: "Golem TNT" },
    desc: { ja: "鉄のゴーレムが並んで現れ、その場を守り始める。", en: "A line of iron golems appears and starts holding the ground." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#c0c4c8", emblem: "golem" },
    effect: "golemEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:iron_block", "minecraft:iron_block", "minecraft:carved_pumpkin"] },
  },
  {
    id: "phantom_tnt",
    name: { ja: "ファントムTNT", en: "Phantom TNT" },
    desc: { ja: "夜を呼び、上空からファントムの群れが降ってくる。", en: "Calls the night down, and a flock of phantoms with it." },
    blast: { power: 2, breaks: false, fire: false },
    visual: { color: "#4c5c74", emblem: "phantom", trail: "minecraft:endrod" },
    effect: "phantomEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:phantom_membrane", "minecraft:phantom_membrane"] },
  },
];
