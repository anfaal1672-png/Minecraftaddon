import { TNT_DEFS } from "../generated/defs.js";
import * as nuclear from "./nuclear.js";
import * as elemental from "./elemental.js";
import * as physics from "./physics.js";
import * as mobs from "./mobs.js";
import * as worldFx from "./world.js";
import * as fun from "./fun.js";

/* ------------------------------------------------------------------ */
/*  効果名 (tools/defs/tnt.json の "effect") → 効果関数                  */
/*  関数はすべて (dimension, center, ctx) を受け取る。                   */
/*  ctx = { def, scale (威力倍率), source (着火したプレイヤー or undefined) } */
/* ------------------------------------------------------------------ */
export const EFFECTS = {
  nuke: nuclear.nukeEffect,
  ultraNuke: nuclear.ultraNukeEffect,
  hydrogenBomb: nuclear.hydrogenBombEffect,
  tsarBomba: nuclear.tsarBombaEffect,
  antimatter: nuclear.antimatterEffect,
  armageddon: nuclear.armageddonEffect,

  ice: elemental.iceEffect,
  poison: elemental.poisonEffect,
  fire: elemental.fireEffect,
  thunder: elemental.thunderEffect,
  lava: elemental.lavaEffect,
  water: elemental.waterEffect,
  darkness: elemental.darknessEffect,
  curse: elemental.curseEffect,
  confusion: elemental.confusionEffect,
  storm: elemental.stormEffect,
  scorched: elemental.scorchedEffect,
  iceage: elemental.iceageEffect,
  tsunami: elemental.tsunamiEffect,
  meteor: elemental.meteorEffect,

  gravity: physics.gravityEffect,
  antiGravity: physics.antiGravityEffect,
  magnetBurst: physics.magnetBurstEffect,
  teleport: physics.teleportEffect,
  swap: physics.swapEffect,
  bouncy: physics.bouncyEffect,
  blackhole: physics.blackholeEffect,
  enderman: physics.endermanEffect,
  chorus: physics.chorusEffect,
  beam: physics.beamEffect,
  arrow: physics.arrowEffect,
  earthquake: physics.earthquakeEffect,
  shaft: physics.shaftEffect,
  vacuum: physics.vacuumEffect,
  timestop: physics.timestopEffect,
  cluster: physics.clusterEffect,

  summon: mobs.summonEffect,
  snowgolem: mobs.snowgolemEffect,
  bee: mobs.beeEffect,
  slime: mobs.slimeEffect,
  animal: mobs.animalEffect,
  ufo: mobs.ufoEffect,

  treasure: worldFx.treasureEffect,
  fortune: worldFx.fortuneEffect,
  smelter: worldFx.smelterEffect,
  harvest: worldFx.harvestEffect,
  builder: worldFx.builderEffect,
  desert: worldFx.desertEffect,
  grass: worldFx.grassEffect,
  cactus: worldFx.cactusEffect,
  obsidian: worldFx.obsidianEffect,
  glow: worldFx.glowEffect,
  honey: worldFx.honeyEffect,
  web: worldFx.webEffect,
  xp: worldFx.xpEffect,
  feast: worldFx.feastEffect,
  mining: worldFx.miningEffect,
  wall: worldFx.wallEffect,
  forest: worldFx.forestEffect,
  bridge: worldFx.bridgeEffect,
  reaper: worldFx.reaperEffect,

  confetti: fun.confettiEffect,
  rainbow: fun.rainbowEffect,
  disco: fun.discoEffect,
  fireworks: fun.fireworksEffect,
  music: fun.musicEffect,
  daynight: fun.daynightEffect,
  heal: fun.healEffect,
  invisibility: fun.invisibilityEffect,
  speed: fun.speedEffect,
};

/** 虹TNTの抽選対象 (核の効果は入れない。B28) */
export const RAINBOW_POOL = [
  "ice", "poison", "fire", "thunder", "teleport", "heal", "confetti", "antiGravity", "lava", "water",
  "darkness", "summon", "earthquake", "bouncy", "web", "treasure", "swap", "confusion", "grass", "desert",
  "snowgolem", "bee", "arrow", "music", "tsunami", "harvest", "xp", "slime", "animal", "honey",
  "feast", "cactus", "glow", "chorus", "timestop", "forest",
];

/** 終焉TNTが追加で発動する効果の候補 */
export const ARMAGEDDON_POOL = [
  "ice", "poison", "thunder", "teleport", "antiGravity", "lava", "water", "darkness", "summon", "earthquake",
  "bouncy", "web", "treasure", "swap", "confusion", "grass", "desert", "snowgolem", "bee", "arrow",
  "music", "tsunami", "harvest", "xp", "enderman", "slime", "animal", "iceage", "fortune", "beam",
  "invisibility", "speed", "honey", "scorched", "feast", "cactus", "obsidian", "glow", "vacuum", "chorus",
  "timestop", "cluster",
];

/** その効果を持つTNTの定義 (表示名に使う) */
export function effectOwner(effectName) {
  return TNT_DEFS.find((d) => d.effect === effectName);
}
