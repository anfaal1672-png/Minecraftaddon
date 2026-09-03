/**
 * このファイルは自動生成される (tools/build.mjs)。直接編集しないこと。
 *
 * 元になっているもの: data/tnt/*.mjs と BP/scripts/effects/*.js
 */
import { collapseEffect, drillEffect, replicatorEffect, singularityEffect, timestopEffect } from "./chaos.js";
import { animalEffect, beeEffect, snowgolemEffect, summonEffect, ufoEffect } from "./creature.js";
import { darknessEffect, fireEffect, iceEffect, iceageEffect, lavaEffect, poisonEffect, scorchedEffect, stormEffect, thunderEffect, tsunamiEffect, vacuumEffect, waterEffect } from "./elemental.js";
import { antiGravityEffect, beamEffect, blackholeEffect, bouncyEffect, chorusEffect, endermanEffect, gravityEffect, magnetBurstEffect, slimeEffect, speedEffect, swapEffect, teleportEffect } from "./motion.js";
import { antimatterEffect, armageddonEffect, hydrogenBombEffect, nukeEffect, tsarBombaEffect, ultraNukeEffect } from "./nuclear.js";
import { arrowEffect, confettiEffect, confusionEffect, curseEffect, discoEffect, fireworksEffect, meteorEffect, musicEffect, rainbowEffect } from "./spectacle.js";
import { builderEffect, cactusEffect, desertEffect, earthquakeEffect, grassEffect, harvestEffect, honeyEffect, obsidianEffect, shaftEffect, smelterEffect } from "./terrain.js";
import { daynightEffect, feastEffect, fortuneEffect, glowEffect, healEffect, invisibilityEffect, treasureEffect, webEffect, xpEffect } from "./utility.js";

/** 効果の名前から実体を引くための表 */
export const EFFECTS = {
  animalEffect,
  antiGravityEffect,
  antimatterEffect,
  armageddonEffect,
  arrowEffect,
  beamEffect,
  beeEffect,
  blackholeEffect,
  bouncyEffect,
  builderEffect,
  cactusEffect,
  chorusEffect,
  collapseEffect,
  confettiEffect,
  confusionEffect,
  curseEffect,
  darknessEffect,
  daynightEffect,
  desertEffect,
  discoEffect,
  drillEffect,
  earthquakeEffect,
  endermanEffect,
  feastEffect,
  fireEffect,
  fireworksEffect,
  fortuneEffect,
  glowEffect,
  grassEffect,
  gravityEffect,
  harvestEffect,
  healEffect,
  honeyEffect,
  hydrogenBombEffect,
  iceEffect,
  iceageEffect,
  invisibilityEffect,
  lavaEffect,
  magnetBurstEffect,
  meteorEffect,
  musicEffect,
  nukeEffect,
  obsidianEffect,
  poisonEffect,
  rainbowEffect,
  replicatorEffect,
  scorchedEffect,
  shaftEffect,
  singularityEffect,
  slimeEffect,
  smelterEffect,
  snowgolemEffect,
  speedEffect,
  stormEffect,
  summonEffect,
  swapEffect,
  teleportEffect,
  thunderEffect,
  timestopEffect,
  treasureEffect,
  tsarBombaEffect,
  tsunamiEffect,
  ufoEffect,
  ultraNukeEffect,
  vacuumEffect,
  waterEffect,
  webEffect,
  xpEffect,
};
