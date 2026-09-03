/**
 * 押す・引く・飛ばす・入れ替えるといった、動きに関わるTNT。
 */
import { system, ItemStack } from "@minecraft/server";
import { announce } from "../core/announce.js";
import { distSq } from "../util/common.js";
import { nearbyEntities, pushEntity, safeTeleport, shockwaveKnockback } from "../util/entities.js";

export function gravityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, 1.4);
    } catch (err) {}
  }
}

export function antiGravityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    try {
      pushEntity(ent, { x: 0, y: 1.4, z: 0 });
      ent.addEffect("minecraft:levitation", 60, { amplifier: 4, showParticles: true });
    } catch (err) {}
  }
  try {
    dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
  } catch (err) {}
}

export function teleportEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    safeTeleport(ent, () => ({
      x: center.x + Math.floor((Math.random() - 0.5) * 24),
      y: center.y + 2,
      z: center.z + Math.floor((Math.random() - 0.5) * 24),
    }));
  }
}

export function chorusEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    const moved = safeTeleport(ent, () => ({
      x: center.x + (Math.random() - 0.5) * 10,
      y: center.y + Math.random() * 4,
      z: center.z + (Math.random() - 0.5) * 10,
    }));
    if (!moved) continue;
    try {
      dimension.playSound("mob.endermen.portal", ent.location);
    } catch (err) {}
  }
  for (let i = 0; i < 3; i++) {
    try {
      dimension.spawnItem(new ItemStack("minecraft:chorus_fruit", 1), {
        x: center.x + (Math.random() - 0.5) * 2,
        y: center.y + 0.5,
        z: center.z + (Math.random() - 0.5) * 2,
      });
    } catch (err) {}
  }
}

export function endermanEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      if (ent.typeId !== "minecraft:player") continue;
      const from = { ...ent.location };
      safeTeleport(ent, () => ({
        x: from.x + (Math.random() - 0.5) * 16,
        y: from.y,
        z: from.z + (Math.random() - 0.5) * 16,
      }));
    } catch (err) {}
  }
  for (let i = 0; i < 3; i++) {
    try {
      dimension.spawnEntity("minecraft:enderman", {
        x: center.x + (Math.random() - 0.5) * 4,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 4,
      });
    } catch (err) {}
  }
}

export function swapEffect(dimension, center) {
  const ents = nearbyEntities(dimension, center, 10)
    .filter((e) => e.typeId !== "minecraft:item" && e.typeId !== "minecraft:xp_orb");
  if (ents.length < 2) return;
  ents.sort((a, b) => {
    const da = distSq(a.location, center);
    const db = distSq(b.location, center);
    return da - db;
  });
  const a = ents[0];
  const b = ents[1];
  const locA = { ...a.location };
  const locB = { ...b.location };
  // 片方だけ飛んで重なるのを避けるため、両方成功したときだけ入れ替える
  if (!safeTeleport(a, () => locB, 1)) return;
  if (!safeTeleport(b, () => locA, 1)) {
    safeTeleport(a, () => locA, 1);
    return;
  }
  try {
    dimension.spawnParticle("minecraft:endrod", locA);
    dimension.spawnParticle("minecraft:endrod", locB);
  } catch (err) {}
}

export function bouncyEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      pushEntity(ent, { x: (Math.random() - 0.5) * 0.4, y: 1.6, z: (Math.random() - 0.5) * 0.4 });
      ent.addEffect("minecraft:jump_boost", 100, { amplifier: 3, showParticles: false });
    } catch (err) {}
  }
  try {
    dimension.playSound("mob.slime.big", center);
  } catch (err) {}
}

export function slimeEffect(dimension, center) {
  for (let i = 0; i < 3; i++) {
    try {
      dimension.spawnEntity("minecraft:slime", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
  for (const ent of nearbyEntities(dimension, center, 5)) {
    pushEntity(ent, { x: 0, y: 0.8, z: 0 });
  }
}

export function speedEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:speed", 300, { amplifier: 3, showParticles: false });
    } catch (err) {}
  }
}

export function beamEffect(dimension, center) {
  const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  for (const d of dirs) {
    for (let dist = 1; dist <= 14; dist++) {
      const loc = { x: center.x + d.x * dist, y: center.y, z: center.z + d.z * dist };
      system.runTimeout(() => {
        try {
          dimension.spawnParticle("minecraft:endrod", loc);
        } catch (err) {}
        for (const ent of nearbyEntities(dimension, loc, 1.2)) {
          try {
            ent.applyDamage(4, { cause: "entityExplosion" });
          } catch (err) {}
        }
      }, dist);
    }
  }
}

export function magnetBurstEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    if (ent.typeId !== "minecraft:item" && ent.typeId !== "minecraft:xp_orb") continue;
    try {
      ent.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.3, z: (Math.random() - 0.5) * 0.3 });
    } catch (err) {}
  }
  try {
    dimension.spawnParticle("minecraft:villager_happy", center);
  } catch (err) {}
}

/**
 * ブラックホールTNT: 広範囲を数秒かけて中心に吸い込み、
 * 中心付近のブロックを消し去った後、最後に一気に弾け飛ばす。
 */
export function blackholeEffect(dimension, center) {
  try {
    announce("§5§l●黒 ブラックホールTNTが空間を歪めた ●黒§r");
  } catch (err) {}

  const radius = 16;
  let pulls = 0;
  const pullId = system.runInterval(() => {
    pulls++;
    for (const ent of nearbyEntities(dimension, center, radius)) {
      try {
        const loc = ent.location;
        const dx = center.x - loc.x;
        const dy = center.y - loc.y;
        const dz = center.z - loc.z;
        const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
        const strength = 0.3;
        pushEntity(ent, {
          x: (dx / dist) * strength,
          y: (dy / dist) * strength * 0.5,
          z: (dz / dist) * strength,
        });
      } catch (err) {}
    }
    for (let n = 0; n < 6; n++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 5;
      try {
        dimension.spawnParticle("minecraft:basic_smoke_particle", {
          x: center.x + Math.cos(ang) * r,
          y: center.y + (Math.random() - 0.5) * 3,
          z: center.z + Math.sin(ang) * r,
        });
      } catch (err) {}
    }
    if (pulls >= 12) {
      system.clearRun(pullId);
      // 中心付近のブロックを消し去る (吸い込まれた跡)
      const R = 3;
      for (let dx = -R; dx <= R; dx++) {
        for (let dy = -R; dy <= R; dy++) {
          for (let dz = -R; dz <= R; dz++) {
            if (dx * dx + dy * dy + dz * dz > R * R) continue;
            try {
              const b = dimension.getBlock({ x: Math.floor(center.x) + dx, y: Math.floor(center.y) + dy, z: Math.floor(center.z) + dz });
              if (b && b.typeId !== "minecraft:bedrock") b.setType("minecraft:air");
            } catch (err) {}
          }
        }
      }
      try {
        dimension.createExplosion(center, 6, { breaksBlocks: false, causesFire: false });
      } catch (err) {}
      shockwaveKnockback(dimension, center, 16, 2.0);
    }
  }, 4);
}

export function confusionEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    try {
      ent.addEffect("minecraft:nausea", 160, { amplifier: 2, showParticles: false });
      ent.addEffect("minecraft:slowness", 80, { amplifier: 1, showParticles: false });
    } catch (err) {}
  }
  for (let n = 0; n < 10; n++) {
    try {
      dimension.spawnParticle("minecraft:mob_spell_particle", {
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 3,
      });
    } catch (err) {}
  }
}
