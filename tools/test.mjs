/**
 * アドオンの回帰テスト。
 *   実行: node --import ./tools/register-mock.mjs tools/test.mjs
 *
 * ゲームを起動せずに BP/scripts/main.js をそのまま読み込み、
 * 爆発イベントを流し込んで挙動を確かめる。
 */
import { world, system } from "@minecraft/server";

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/* ------------------------------------------------------------------ */
/*  疑似ディメンション                                                  */
/* ------------------------------------------------------------------ */
function makeDimension(entities = []) {
  const blocks = new Map();
  const spawned = [];
  const explosions = [];
  const key = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;

  return {
    id: "minecraft:overworld",
    blocks, spawned, explosions,
    setBlock(loc, typeId) { blocks.set(key(loc), typeId); },
    blockAt(loc) { return blocks.get(key(loc)) ?? "minecraft:air"; },
    getBlock(loc) {
      const k = key(loc);
      const typeId = blocks.get(k) ?? "minecraft:air";
      return {
        typeId,
        location: { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) },
        setType: (id) => blocks.set(k, id),
        getRedstonePower: () => 0,
      };
    },
    spawnEntity(typeId, loc) {
      const tags = [];
      const entity = {
        typeId, location: { ...loc },
        addTag: (t) => tags.push(t),
        getTags: () => tags,
        remove() { this.removed = true; },
        applyImpulse() {}, applyKnockback() {},
      };
      spawned.push(entity);
      return entity;
    },
    getEntities: () => entities,
    createExplosion(loc, power, opts) { explosions.push({ loc, power, opts }); return true; },
    spawnParticle() {}, playSound() {}, spawnItem() {},
  };
}

/** 実機と同じく applyImpulse がプレイヤーに対して例外を投げるモック */
function makePlayer() {
  const log = { impulse: 0, knockback: 0, effects: [] };
  return {
    typeId: "minecraft:player",
    location: { x: 0, y: 64, z: 0 },
    log,
    applyImpulse() {
      log.impulse++;
      throw new Error("This method is not supported for players");
    },
    applyKnockback() { log.knockback++; },
    addEffect(id) { log.effects.push(id); },
    applyDamage() {}, teleport() {}, getTags: () => [],
  };
}

await import("../BP/scripts/main.js");
const onExplosion = world.beforeEvents.explosion.handlers[0];

/** うちのTNT以外 (クリーパー等) の爆発を起こし、連鎖判定を走らせる */
function vanillaExplosionAt(dimension, loc) {
  onExplosion({
    dimension,
    source: { typeId: "minecraft:creeper", location: loc, getTags: () => [] },
    getImpactedBlocks: () => [],
    set cancel(_) {},
  });
}

/* ------------------------------------------------------------------ */
console.log("\n連鎖爆発でTNTが増殖しないこと");
{
  const dim = makeDimension();
  const tnts = [{ x: 10, y: 64, z: 0 }, { x: 11, y: 64, z: 0 }, { x: 12, y: 64, z: 0 }];
  for (const t of tnts) dim.setBlock(t, "manytnt:mega_tnt");

  // 2つの爆発がほぼ同時に同じTNT群を巻き込む状況
  vanillaExplosionAt(dim, { x: 10, y: 64, z: 2 });
  vanillaExplosionAt(dim, { x: 12, y: 64, z: 2 });
  system.advance(200);

  const count = dim.spawned.filter((e) => e.typeId === "minecraft:tnt").length;
  check("TNTブロック1個につきTNTエンティティ1個", count === tnts.length,
        `ブロック${tnts.length}個 → エンティティ${count}個`);
  check("着火したブロックは消費されている",
        tnts.every((t) => dim.blockAt(t) === "minecraft:air"));
}

/* ------------------------------------------------------------------ */
console.log("\n空気になった座標から再着火しないこと");
{
  const dim = makeDimension();
  dim.setBlock({ x: 0, y: 64, z: 0 }, "manytnt:mega_tnt");
  for (let i = 0; i < 5; i++) vanillaExplosionAt(dim, { x: 0, y: 64, z: 2 });
  system.advance(200);
  const count = dim.spawned.filter((e) => e.typeId === "minecraft:tnt").length;
  check("5回巻き込んでもTNTエンティティは1個", count === 1, `${count}個`);
}

/* ------------------------------------------------------------------ */
console.log("\nガチャTNT: 告知した種類が実際に爆発すること");
{
  const dim = makeDimension();
  world._messages.length = 0;
  world._props.delete("manytnt:stats");
  dim.setBlock({ x: 20, y: 64, z: 0 }, "manytnt:gacha_tnt");
  vanillaExplosionAt(dim, { x: 20, y: 64, z: 2 });
  system.advance(300);

  const announced = world._messages
    .find((m) => m.includes("ガチャTNT"))
    ?.replace(/§./g, "")
    .match(/ガチャTNT: (\w+)/)?.[1];
  const stats = JSON.parse(world.getDynamicProperty("manytnt:stats") ?? "{}");
  const exploded = Object.keys(stats.counts ?? {});
  check("連鎖着火でも引いた中身が反映される",
        !!announced && exploded.includes(announced),
        `告知=${announced} / 実際=${exploded.join(",") || "なし"}`);
}

/* ------------------------------------------------------------------ */
console.log("\n吸い込み・打ち上げ系がプレイヤーにも効くこと");
{
  const player = makePlayer();
  const dim = makeDimension([player]);
  dim.setBlock({ x: 30, y: 64, z: 0 }, "manytnt:antigravity_tnt");
  vanillaExplosionAt(dim, { x: 30, y: 64, z: 2 });
  system.advance(300);

  check("反重力TNTがプレイヤーを打ち上げる", player.log.knockback > 0,
        `applyKnockback ${player.log.knockback}回`);
  check("打ち上げの例外で後続の効果が飛ばされない",
        player.log.effects.includes("minecraft:levitation"),
        player.log.effects.join(",") || "効果なし");
}
{
  const player = makePlayer();
  const dim = makeDimension([player]);
  dim.setBlock({ x: 40, y: 64, z: 0 }, "manytnt:blackhole_tnt");
  vanillaExplosionAt(dim, { x: 40, y: 64, z: 2 });
  system.advance(400);
  check("ブラックホールTNTがプレイヤーを引き寄せる", player.log.knockback > 0,
        `applyKnockback ${player.log.knockback}回`);
}

/* ------------------------------------------------------------------ */
console.log("\n爆発の威力が安全上限内に収まること");
{
  const dim = makeDimension();
  dim.setBlock({ x: 50, y: 64, z: 0 }, "manytnt:armageddon_tnt");
  vanillaExplosionAt(dim, { x: 50, y: 64, z: 2 });
  system.advance(400);
  const over = dim.explosions.filter((e) => e.power > 100);
  check("createExplosion の威力は常に100以下", over.length === 0,
        `最大 ${Math.max(0, ...dim.explosions.map((e) => e.power))}`);
}

/* ------------------------------------------------------------------ */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);
if (failed.length) {
  console.error(`失敗: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
