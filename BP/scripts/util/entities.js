/**
 * エンティティを探す・押す・飛ばす・巻き込む処理。
 */
import { system } from "@minecraft/server";

/* ------------------------------------------------------------------ */
/*  ユーティリティ                                                     */
/* ------------------------------------------------------------------ */
export function nearbyEntities(dimension, center, radius, includePlayers = true) {
  try {
    const found = dimension.getEntities({ location: center, maxDistance: radius });
    if (includePlayers) return found;
    return found.filter((ent) => ent.typeId !== "minecraft:player");
  } catch (err) {
    return [];
  }
}

/**
 * エンティティを指定したベクトルの方向へ押し出す。
 *
 * Entity.applyImpulse() はプレイヤーに対しては未実装で、呼ぶと例外を投げる。
 * これまで吸い込み・打ち上げ系の処理はすべて applyImpulse を直接呼んでいたため、
 * プレイヤーにだけ全く効かず、さらに同じ try ブロック内でその後に続く
 * addEffect() まで巻き添えで飛ばされていた
 * (例: 反重力TNTがプレイヤーには浮遊効果すら付かなかった)。
 *
 * プレイヤーには applyKnockback(水平ベクトル, 垂直の強さ) を使えば
 * 同じ動きを再現できるので、ここで一括して振り分ける。
 */
export function pushEntity(ent, vec) {
  try {
    if (ent.typeId === "minecraft:player") {
      ent.applyKnockback({ x: vec.x, z: vec.z }, vec.y);
    } else {
      ent.applyImpulse(vec);
    }
  } catch (err) {
    // applyKnockback が旧シグネチャ (dx, dz, 水平強さ, 垂直強さ) の端末向けの保険
    try {
      const h = Math.sqrt(vec.x * vec.x + vec.z * vec.z);
      ent.applyKnockback(h > 0 ? vec.x / h : 0, h > 0 ? vec.z / h : 0, h, vec.y);
    } catch (err2) {}
  }
}

/**
 * ブロックの中に埋めてしまわないテレポート。
 *
 * これまでのテレポート系TNTは行き先を確かめずに座標を指定していたため、
 * 山や洞窟の中に送り込まれて即窒息、ということが普通に起きていた。
 * tryTeleport に checkForBlocks を付けると、埋まる位置なら移動せず
 * false が返るので、候補を何度か引き直して安全な場所を探す。
 * どれも駄目なら移動しない (元の位置のほうがまだ安全なため)。
 *
 * @param pick 試行回数を受け取って行き先を返す関数
 */
export function safeTeleport(entity, pick, tries = 8) {
  if (typeof entity.tryTeleport !== "function") {
    // tryTeleport が無い端末向けの保険
    try {
      entity.teleport(pick(0));
      return true;
    } catch (err) {
      return false;
    }
  }
  for (let i = 0; i < tries; i++) {
    try {
      if (entity.tryTeleport(pick(i), { checkForBlocks: true })) return true;
    } catch (err) {}
  }
  return false;
}

export function pullNearbyEntities(dimension, center, radius) {
  for (const ent of nearbyEntities(dimension, center, radius)) {
    try {
      const loc = ent.location;
      const dx = center.x - loc.x;
      const dy = center.y - loc.y;
      const dz = center.z - loc.z;
      const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const strength = 0.12;
      pushEntity(ent, {
        x: (dx / dist) * strength,
        y: (dy / dist) * strength * 0.6,
        z: (dz / dist) * strength,
      });
    } catch (err) {}
  }
}

export function pullNearbyItems(dimension, center, radius) {
  for (const ent of nearbyEntities(dimension, center, radius)) {
    if (ent.typeId !== "minecraft:item" && ent.typeId !== "minecraft:xp_orb") continue;
    try {
      const loc = ent.location;
      const dx = center.x - loc.x;
      const dy = center.y - loc.y;
      const dz = center.z - loc.z;
      const dist = Math.max(0.3, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const strength = 0.25;
      ent.applyImpulse({
        x: (dx / dist) * strength,
        y: (dy / dist) * strength * 0.5,
        z: (dz / dist) * strength,
      });
    } catch (err) {}
  }
}

/** 広範囲の爆風の余波でエンティティを吹き飛ばす */
export function shockwaveKnockback(dimension, center, radius, maxStrength) {
  for (const ent of nearbyEntities(dimension, center, radius)) {
    try {
      const loc = ent.location;
      const dx = loc.x - center.x;
      const dz = loc.z - center.z;
      const dist = Math.max(1, Math.sqrt(dx * dx + dz * dz));
      const strength = Math.max(0.3, maxStrength - (dist / radius) * maxStrength);
      ent.applyKnockback({ x: dx / dist, z: dz / dist }, strength);
    } catch (err) {}
  }
}

/**
 * 壁を完全に無視して届く直接ダメージ。
 * 実際の核爆発と同じく2段構成:
 *  1発目 = 熱線 (即時、フルダメージ)
 *  2発目 = 爆風の到達 (少し遅れて半分のダメージ + 上方向へ吹き飛ばし)
 * どちらも遮蔽物・壁に関係なく範囲内の全モブに届く。
 */
export function irradiateEntities(dimension, center, radius, maxDamage) {
  const pulse = (damageScale, launch) => {
    for (const ent of nearbyEntities(dimension, center, radius)) {
      if (ent.typeId === "minecraft:item" || ent.typeId === "minecraft:xp_orb") continue;
      try {
        const loc = ent.location;
        const dx = loc.x - center.x;
        const dy = loc.y - center.y;
        const dz = loc.z - center.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const falloff = Math.max(0, 1 - dist / radius);
        const dmg = Math.max(2, maxDamage * damageScale * falloff);
        ent.applyDamage(dmg, { cause: "entityExplosion" });
        if (launch && falloff > 0.15) {
          pushEntity(ent, { x: 0, y: 0.6 * falloff, z: 0 });
        }
      } catch (err) {}
    }
  };
  pulse(1.0, false); // 熱線
  system.runTimeout(() => pulse(0.5, true), 8); // 爆風到達
}
