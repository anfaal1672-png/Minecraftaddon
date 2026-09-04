/**
 * エンティティを探す・押す・飛ばす・傷つける処理。
 */
import { system } from "@minecraft/server";
import { note } from "../core/log.js";
import { dist, falloff, horizontalDirection } from "./math.js";

export const ITEM_LIKE = new Set(["minecraft:item", "minecraft:xp_orb"]);

/**
 * 導火線が燃えている最中のTNT。
 *
 * 本家のTNTは、他の爆発に巻き込まれても吹き飛ぶだけで壊れない。
 * ダメージ・状態異常・テレポートの対象にしてしまうと、
 * 「着火したのに爆発せずに消えた」という形で壊れるので、
 * こちらから手を出す対象からは既定で外しておく。
 */
export const PRIMED_TNT_TYPES = new Set(["manytnt:primed_tnt", "minecraft:tnt"]);

/**
 * 周囲のエンティティ。
 * @param options.players プレイヤーを含めるか (既定 true)
 * @param options.items   アイテムと経験値オーブを含めるか (既定 true)
 * @param options.tnt     起爆中のTNTを含めるか (既定 false)
 */
export function entitiesNear(dimension, center, radius, { players = true, items = true, tnt = false } = {}) {
  let found;
  try {
    found = dimension.getEntities({ location: center, maxDistance: radius });
  } catch (err) {
    return [];
  }
  return found.filter((ent) => {
    if (!players && ent.typeId === "minecraft:player") return false;
    if (!items && ITEM_LIKE.has(ent.typeId)) return false;
    if (!tnt && PRIMED_TNT_TYPES.has(ent.typeId)) return false;
    return true;
  });
}

/** アイテムと経験値オーブだけ */
export function itemsNear(dimension, center, radius) {
  return entitiesNear(dimension, center, radius).filter((ent) => ITEM_LIKE.has(ent.typeId));
}

/** そのエンティティの現在地。取れなければ null */
export function locationOf(entity) {
  try {
    return { ...entity.location };
  } catch (err) {
    return null;
  }
}

/** まだ世界にいるか */
export function isAlive(entity) {
  try {
    return entity.isValid !== false && !!entity.location;
  } catch (err) {
    return false;
  }
}

/**
 * エンティティを指定した向きへ押し出す。
 *
 * Entity.applyImpulse() はプレイヤーには使えず、呼ぶと例外になる。
 * プレイヤーには applyKnockback(水平ベクトル, 垂直の強さ) を使えば
 * 同じ動きになるので、ここで一括して振り分ける。
 */
export function push(entity, vec) {
  try {
    if (entity.typeId === "minecraft:player") {
      entity.applyKnockback({ x: vec.x, z: vec.z }, vec.y ?? 0);
    } else {
      entity.applyImpulse(vec);
    }
    return true;
  } catch (err) {
    // applyKnockback が旧い形 (dx, dz, 水平強さ, 垂直強さ) の端末向けの保険
    try {
      const h = Math.sqrt(vec.x * vec.x + vec.z * vec.z);
      entity.applyKnockback(h > 0 ? vec.x / h : 0, h > 0 ? vec.z / h : 0, h, vec.y ?? 0);
      return true;
    } catch (err2) {
      return false;
    }
  }
}

/** 状態異常を付ける。無いIDでも落ちない */
export function addEffect(entity, effectId, ticks, { amplifier = 0, showParticles = true } = {}) {
  try {
    entity.addEffect(effectId, ticks, { amplifier, showParticles });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 範囲内の全員に、まとめて状態異常を付ける。
 * @param effects [[id, ticks, amplifier, showParticles?], ...]
 */
export function applyEffects(dimension, center, radius, effects, options = {}) {
  const targets = entitiesNear(dimension, center, radius, { items: false, ...options });
  for (const ent of targets) {
    for (const [id, ticks, amplifier = 0, showParticles = false] of effects) {
      addEffect(ent, id, ticks, { amplifier, showParticles });
    }
  }
  return targets.length;
}

/**
 * 外向きに吹き飛ばす。中心から遠いほど弱くなる。
 * 起爆中のTNTも一緒に飛ばす (本家の爆発と同じ)。
 */
export function knockOutward(dimension, center, radius, maxStrength, { lift = 0.35 } = {}) {
  for (const ent of entitiesNear(dimension, center, radius, { tnt: true })) {
    const loc = locationOf(ent);
    if (!loc) continue;
    const dir = horizontalDirection(center, loc);
    const strength = Math.max(0.3, maxStrength * falloff(dist(center, loc), radius));
    push(ent, { x: dir.x * strength, y: strength * lift, z: dir.z * strength });
  }
}

/**
 * 中心へ引き寄せる。近いほど強く引く。
 * 起爆中のTNTも一緒に引き込む (本家の爆発と同じで、壊しはしない)。
 */
export function pullInward(dimension, center, radius, strength, { vertical = 0.6, cap = 1.4 } = {}) {
  for (const ent of entitiesNear(dimension, center, radius, { tnt: true })) {
    const loc = locationOf(ent);
    if (!loc) continue;
    const dx = center.x - loc.x, dy = center.y - loc.y, dz = center.z - loc.z;
    const d = Math.max(0.8, Math.sqrt(dx * dx + dy * dy + dz * dz));
    const k = Math.min(cap, strength * (radius / (d * d)));
    push(ent, { x: (dx / d) * k, y: (dy / d) * k * vertical, z: (dz / d) * k });
  }
}

/** アイテムだけを中心へ吸い寄せる */
export function pullItems(dimension, center, radius, strength = 0.25) {
  for (const ent of itemsNear(dimension, center, radius)) {
    const loc = locationOf(ent);
    if (!loc) continue;
    const dx = center.x - loc.x, dy = center.y - loc.y, dz = center.z - loc.z;
    const d = Math.max(0.3, Math.sqrt(dx * dx + dy * dy + dz * dz));
    try {
      ent.applyImpulse({ x: (dx / d) * strength, y: (dy / d) * strength * 0.5, z: (dz / d) * strength });
    } catch (err) {
      /* アイテムなら applyImpulse が使えるはずだが、消えた直後などは失敗する */
    }
  }
}

/**
 * ブロックの中に埋めてしまわないテレポート。
 *
 * 行き先を確かめずに飛ばすと、山や洞窟の中に送り込まれて即窒息する。
 * tryTeleport に checkForBlocks を付けると、埋まる位置なら移動せず
 * false が返るので、候補を何度か引き直して安全な場所を探す。
 * どれも駄目なら移動しない (元の位置のほうがまだ安全なため)。
 *
 * @param pick 試行回数を受け取って行き先を返す関数
 */
export function safeTeleport(entity, pick, tries = 8) {
  if (typeof entity.tryTeleport !== "function") {
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
    } catch (err) {
      /* 次の候補へ */
    }
  }
  return false;
}

/** ダメージ。距離が遠いほど弱くなる */
export function damageArea(dimension, center, radius, maxDamage, { minDamage = 2, launch = 0 } = {}) {
  let hit = 0;
  for (const ent of entitiesNear(dimension, center, radius, { items: false })) {
    const loc = locationOf(ent);
    if (!loc) continue;
    const k = falloff(dist(center, loc), radius);
    const damage = Math.max(minDamage, maxDamage * k);
    try {
      ent.applyDamage(damage, { cause: "entityExplosion" });
      hit++;
    } catch (err) {
      continue;
    }
    if (launch > 0 && k > 0.15) push(ent, { x: 0, y: launch * k, z: 0 });
  }
  return hit;
}

/**
 * 壁を無視して届く2段構えのダメージ。実際の核爆発と同じ構成。
 *   1発目 = 熱線 (即時、フルダメージ)
 *   2発目 = 爆風の到達 (少し遅れて半分、上へ吹き飛ばし)
 */
export function irradiate(dimension, center, radius, maxDamage) {
  damageArea(dimension, center, radius, maxDamage);
  try {
    system.runTimeout(() => damageArea(dimension, center, radius, maxDamage * 0.5, { launch: 0.6 }), 8);
  } catch (err) {
    note("entities:irradiate", err);
  }
}

/** モブを湧かせる。湧いたエンティティを返す (失敗したら null) */
export function spawn(dimension, typeId, loc) {
  try {
    return dimension.spawnEntity(typeId, loc);
  } catch (err) {
    return null;
  }
}

/** アイテムを落とす */
export function dropItem(dimension, stack, loc, impulse = null) {
  try {
    const item = dimension.spawnItem(stack, loc);
    if (impulse) {
      try {
        item.applyImpulse(impulse);
      } catch (err) {}
    }
    return item;
  } catch (err) {
    return null;
  }
}
