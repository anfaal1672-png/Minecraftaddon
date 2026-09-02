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
  const blocks = new Map();      // "x,y,z" -> { typeId, states }
  const writes = new Map();      // "x,y,z" -> setType が呼ばれた回数
  const spawned = [];
  const explosions = [];
  const commands = [];
  const key = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;

  return {
    id: "minecraft:overworld",
    blocks, writes, spawned, explosions, commands,
    setBlock(loc, typeId, states = {}) { blocks.set(key(loc), { typeId, states }); },
    blockAt(loc) { return (blocks.get(key(loc)) ?? { typeId: "minecraft:air" }).typeId; },
    statesAt(loc) { return (blocks.get(key(loc)) ?? {}).states ?? {}; },
    getBlock(loc) {
      const k = key(loc);
      const rec = blocks.get(k) ?? { typeId: "minecraft:air", states: {} };
      return {
        typeId: rec.typeId,
        location: { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) },
        setType(id) {
          writes.set(k, (writes.get(k) ?? 0) + 1);
          blocks.set(k, { typeId: id, states: {} });
        },
        setPermutation(perm) { blocks.set(k, { typeId: rec.typeId, states: { ...perm.states } }); },
        permutation: {
          getState: (name) => rec.states[name],
          withState: (name, value) => ({ states: { ...rec.states, [name]: value } }),
        },
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
    runCommand(cmd) { commands.push(cmd); return { successCount: 1 }; },
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
console.log("\n核TNT: 隙間のないすり鉢状クレーターを短時間で掘ること");
{
  const dim = makeDimension();
  const R = 24;
  // 爆心地の周りを石で埋めておく
  for (let dx = -R; dx <= R; dx++)
    for (let dz = -R; dz <= R; dz++)
      for (let dy = -12; dy <= 2; dy++)
        dim.setBlock({ x: 100 + dx, y: 64 + dy, z: dx * 0 + dz }, "minecraft:stone");

  dim.setBlock({ x: 100, y: 64, z: 0 }, "manytnt:nuke_tnt");
  vanillaExplosionAt(dim, { x: 100, y: 64, z: 2 });

  // 放射能ゾーンやきのこ雲は数百tick残り続けるので、
  // 「掘削が終わった時刻」はブロック書き込みが止まった時点で測る
  let lastDigTick = 0;
  let seen = 0;
  for (let t = 1; t <= 600; t++) {
    system.advance(1);
    const total = [...dim.writes.values()].reduce((a, b) => a + b, 0);
    if (total > seen) { seen = total; lastDigTick = t; }
  }

  // 中心付近の柱がきちんと掘れているか (半径の6割まではまず穴が空いているはず)
  let dug = 0, checked = 0;
  for (let dx = -9; dx <= 9; dx++) {
    for (let dz = -9; dz <= 9; dz++) {
      if (dx * dx + dz * dz > 81) continue;
      checked++;
      if (dim.blockAt({ x: 100 + dx, y: 63, z: dz }) === "minecraft:air") dug++;
    }
  }
  const ratio = dug / checked;
  check("クレーターの内側に隙間がない", ratio > 0.95, `${(ratio * 100).toFixed(0)}% が掘れている`);

  // すり鉢状か: 中心ほど深く、外へ行くほど浅くなっているはず。
  // 柱ごとの深さには意図的なばらつきを入れてあるので、
  // 1本だけ見ると前後する。同じ半径の柱をまとめて平均で比べる。
  const avgDepth = (rMin, rMax) => {
    let sum = 0;
    let n = 0;
    for (let dx = -16; dx <= 16; dx++) {
      for (let dz = -16; dz <= 16; dz++) {
        const r = Math.sqrt(dx * dx + dz * dz);
        if (r < rMin || r > rMax) continue;
        let d = 0;
        for (let y = 64; y >= 36; y--) {
          if (dim.blockAt({ x: 100 + dx, y, z: dz }) !== "minecraft:air") break;
          d++;
        }
        sum += d;
        n++;
      }
    }
    return n ? sum / n : 0;
  };
  const inner = avgDepth(0, 3);
  const mid = avgDepth(7, 9);
  const outer = avgDepth(13, 15);
  check("中心ほど深いすり鉢状になっている", inner > mid && mid > outer,
        `中心${inner.toFixed(1)} > 中間${mid.toFixed(1)} > 外周${outer.toFixed(1)} ブロック`);
  check("掘り終わるまでが十分速い", lastDigTick < 160,
        `${lastDigTick} tick (${(lastDigTick / 20).toFixed(1)}秒) で掘削完了`);
}

/* ------------------------------------------------------------------ */
console.log("\n虹TNTが核爆発を引き当てないこと");
{
  const dim = makeDimension();
  let sawNuke = false;
  for (let trial = 0; trial < 150; trial++) {
    world._messages.length = 0;
    dim.setBlock({ x: 200, y: 64, z: 0 }, "manytnt:rainbow_tnt");
    vanillaExplosionAt(dim, { x: 200, y: 64, z: 2 });
    system.advance(40);
    if (world._messages.some((m) => m.includes("核TNT") || m.includes("nukeEffect"))) sawNuke = true;
  }
  check("虹TNTの抽選に核が含まれない", !sawNuke,
        sawNuke ? "核TNTを引き当ててしまった" : "150回抽選して核は一度も出なかった");
}

/* ------------------------------------------------------------------ */
console.log("\n津波TNTが元からある水を消さないこと");
{
  const dim = makeDimension();
  const pond = { x: 303, y: 64, z: 0 };
  dim.setBlock(pond, "minecraft:water");           // 元からある池
  dim.setBlock({ x: 300, y: 64, z: 0 }, "manytnt:tsunami_tnt");
  vanillaExplosionAt(dim, { x: 300, y: 64, z: 2 });
  system.advance(400);
  check("引き潮のあとも元の水が残っている", dim.blockAt(pond) === "minecraft:water", dim.blockAt(pond));
}

/* ------------------------------------------------------------------ */
console.log("\n嵐TNTが実際に天候を変えること");
{
  const dim = makeDimension();
  world._weather = null;
  dim.setBlock({ x: 400, y: 64, z: 0 }, "manytnt:storm_tnt");
  vanillaExplosionAt(dim, { x: 400, y: 64, z: 2 });
  system.advance(120);
  check("天候が雷雨になる", world._weather?.type === "Thunder",
        world._weather ? `${world._weather.type}` : "変わっていない");
}

/* ------------------------------------------------------------------ */
console.log("\n豊作TNTが作物を実らせること");
{
  const dim = makeDimension();
  dim.setBlock({ x: 502, y: 64, z: 0 }, "minecraft:wheat", { growth: 1 });
  dim.setBlock({ x: 503, y: 64, z: 0 }, "minecraft:beetroot", { growth: 1 });
  dim.setBlock({ x: 504, y: 64, z: 0 }, "minecraft:nether_wart", { age: 0 });
  dim.setBlock({ x: 500, y: 64, z: 0 }, "manytnt:harvest_tnt");
  vanillaExplosionAt(dim, { x: 500, y: 64, z: 2 });
  system.advance(120);
  check("小麦が最大まで育つ", dim.statesAt({ x: 502, y: 64, z: 0 }).growth === 7);
  check("ビートルートが最大まで育つ", dim.statesAt({ x: 503, y: 64, z: 0 }).growth === 7,
        `growth=${dim.statesAt({ x: 503, y: 64, z: 0 }).growth}`);
  check("ネザーウォートが最大まで育つ", dim.statesAt({ x: 504, y: 64, z: 0 }).age === 3,
        `age=${dim.statesAt({ x: 504, y: 64, z: 0 }).age}`);
}

/* ------------------------------------------------------------------ */
console.log("\nテレポート先がブロックの中にならないこと");
{
  let buried = false;
  const player = {
    typeId: "minecraft:player", location: { x: 600, y: 64, z: 0 },
    // 実機同様、埋まる位置なら false を返す (ここでは 3回に2回は埋まる想定)
    tryTeleport(loc, opts) {
      if (!opts?.checkForBlocks) { buried = true; return true; }
      return Math.random() < 0.34;
    },
    teleport() { buried = true; },
    addEffect() {}, applyImpulse() {}, applyKnockback() {}, applyDamage() {},
    getTags: () => [],
  };
  const dim = makeDimension([player]);
  dim.setBlock({ x: 600, y: 64, z: 0 }, "manytnt:teleport_tnt");
  vanillaExplosionAt(dim, { x: 600, y: 64, z: 2 });
  system.advance(120);
  check("行き先を確かめずに飛ばさない", !buried);
}

/* ------------------------------------------------------------------ */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);
if (failed.length) {
  console.error(`失敗: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
