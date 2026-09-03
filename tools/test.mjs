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

/** 起爆中エンティティの識別子 */
const PRIMED_TNT = "manytnt:primed_tnt";

/**
 * 導火線の模擬。
 * 実機では BP/entities/primed_tnt.json の minecraft:explode が
 * 4秒後 (連鎖なら 0.5〜2秒後) に爆発させ、それが
 * world.beforeEvents.explosion として飛んでくる。ここではそれを再現する。
 */
function primeFuse(dimension, entity, ticks) {
  if (entity._fuseId !== undefined) system.clearRun(entity._fuseId);
  entity._fuseId = system.runTimeout(() => {
    if (entity.removed) return;
    entity.removed = true;
    onExplosion({
      dimension,
      source: entity,
      getImpactedBlocks: () => [],
      set cancel(_) {},
    });
  }, ticks);
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
      const props = {};
      const dim = this;
      const entity = {
        typeId, location: { ...loc },
        addTag: (t) => tags.push(t),
        getTags: () => tags,
        setProperty(name, value) { props[name] = value; },
        getProperty(name) { return props[name]; },
        // 実機では minecraft:explode の component_group が導火線を短くする
        triggerEvent(name) {
          if (name === "manytnt:short_fuse") primeFuse(dim, entity, 10 + Math.floor(Math.random() * 31));
        },
        remove() { this.removed = true; },
        applyImpulse() {}, applyKnockback() {},
      };
      spawned.push(entity);
      // 起爆中エンティティは minecraft:explode を持つので、放っておくと自分で爆発する
      if (typeId === PRIMED_TNT) primeFuse(dim, entity, 80);
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

  const count = dim.spawned.filter((e) => e.typeId === PRIMED_TNT).length;
  check("TNTブロック1個につき起爆中エンティティ1個", count === tnts.length,
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
  const count = dim.spawned.filter((e) => e.typeId === PRIMED_TNT).length;
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
console.log("\n核TNT: 爆心地を中心とした球が消し飛ぶこと");
{
  const dim = makeDimension();
  const R = 30;
  // 爆心地をぐるりと石で囲む (上下ともに)
  for (let dx = -R; dx <= R; dx++)
    for (let dz = -R; dz <= R; dz++)
      for (let dy = -R; dy <= R; dy++)
        dim.setBlock({ x: 100 + dx, y: 64 + dy, z: dz }, "minecraft:stone");

  dim.setBlock({ x: 100, y: 64, z: 0 }, "manytnt:nuke_tnt");
  vanillaExplosionAt(dim, { x: 100, y: 64, z: 2 });

  let lastDigTick = 0;
  let seen = 0;
  for (let t = 1; t <= 600; t++) {
    system.advance(1);
    const total = [...dim.writes.values()].reduce((a, b) => a + b, 0);
    if (total > seen) { seen = total; lastDigTick = t; }
  }

  // これまでは爆心地より上がほとんど残っていた。そこを重点的に確かめる
  const above = [4, 8, 12, 16].filter((dy) => dim.blockAt({ x: 100, y: 64 + dy, z: 0 }) === "minecraft:air");
  check("爆心地より上も壊れる", above.length === 4,
        `上方向 4/8/12/16 ブロックのうち ${above.length} 箇所が消えた`);

  const below = [4, 8, 12, 16].filter((dy) => dim.blockAt({ x: 100, y: 64 - dy, z: 0 }) === "minecraft:air");
  check("上下どちらにも同じだけ広がる", below.length === above.length,
        `上 ${above.length} / 下 ${below.length}`);

  // 球なら、中心の柱がいちばん高く、外へ行くほど低くなる
  const heightAt = (dx) => {
    let n = 0;
    for (let dy = -R; dy <= R; dy++) {
      if (dim.blockAt({ x: 100 + dx, y: 64 + dy, z: 0 }) === "minecraft:air") n++;
    }
    return n;
  };
  const [hCenter, hMid, hEdge] = [heightAt(0), heightAt(12), heightAt(21)];
  check("球状になっている (中心が高く外ほど低い)", hCenter > hMid && hMid > hEdge && hEdge > 0,
        `中心${hCenter} > 中間${hMid} > 外周${hEdge} ブロック`);

  check("掘り終わるまでが十分速い", lastDigTick < 200,
        `${lastDigTick} tick (${(lastDigTick / 20).toFixed(1)}秒) / ${seen} ブロック`);
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
console.log("\n起爆中のTNTが種類ごとの見た目になること");
{
  const fsMod = await import("node:fs");
  const rc = JSON.parse(fsMod.readFileSync("RP/render_controllers/primed_tnt.render_controllers.json", "utf8"));
  const skins = rc.render_controllers["controller.render.manytnt_primed_tnt"].arrays.textures["array.skins"];

  // 適当に散らした数種類で、着火したエンティティの見た目が
  // そのTNTのものになっているかを確かめる
  const samples = ["mega_tnt", "nuke_tnt", "blackhole_tnt", "gacha_tnt"];
  const wrong = [];
  let sawVanilla = 0;
  let sawPrimed = 0;
  for (const type of samples) {
    const dim = makeDimension();
    dim.setBlock({ x: 700, y: 64, z: 0 }, `manytnt:${type}`);
    vanillaExplosionAt(dim, { x: 700, y: 64, z: 2 });
    system.advance(20);
    sawVanilla += dim.spawned.filter((e) => e.typeId === "minecraft:tnt").length;
    const ent = dim.spawned.find((e) => e.typeId === PRIMED_TNT);
    if (!ent) { wrong.push(`${type}: 起爆中エンティティが湧かなかった`); continue; }
    sawPrimed++;
    const kind = ent.getProperty("manytnt:kind");
    // ガチャTNTは引いた中身の見た目になるのが正しいので、種類名までは問わない
    const shown = skins[kind]?.replace("Texture.", "");
    if (shown === undefined) wrong.push(`${type}: kind=${kind} に対応するテクスチャが無い`);
    else if (type !== "gacha_tnt" && shown !== type) wrong.push(`${type} なのに ${shown} の見た目になっている`);
  }
  check("バニラのTNTではなく専用エンティティが湧く",
        sawPrimed === samples.length && sawVanilla === 0,
        `専用 ${sawPrimed}/${samples.length}, バニラ ${sawVanilla}`);
  check("着火したTNTの見た目が種類と一致する", wrong.length === 0, wrong.join(" / ") || `${samples.length}種類を確認`);

  // レンダーコントローラの並びが main.js の TNT_TABLE と一致していること
  const { tntTypesInOrder } = await import("./lib/tnt-types.mjs");
  const order = tntTypesInOrder();
  const listed = skins.map((t) => t.replace("Texture.", ""));
  check("見た目の一覧が main.js の並びと一致する",
        order.length === listed.length && order.every((t, i) => t === listed[i]),
        `${listed.length} 件`);
}

/* ------------------------------------------------------------------ */
console.log("\n特異点TNT: 球状に空間を消し、暴走しないこと");
{
  const dim = makeDimension();
  for (let dx = -30; dx <= 30; dx++)
    for (let dz = -30; dz <= 30; dz++)
      for (let dy = -20; dy <= 20; dy++)
        dim.setBlock({ x: 900 + dx, y: 64 + dy, z: dz }, "minecraft:stone");
  dim.setBlock({ x: 900, y: 64, z: 0 }, "manytnt:singularity_tnt");
  vanillaExplosionAt(dim, { x: 900, y: 64, z: 2 });

  let peak = 0;
  let last = 0;
  let seen = 0;
  for (let t = 1; t <= 400; t++) {
    const before = [...dim.writes.values()].reduce((a, b) => a + b, 0);
    system.advance(1);
    const now = [...dim.writes.values()].reduce((a, b) => a + b, 0);
    peak = Math.max(peak, now - before);
    if (now > seen) { seen = now; last = t; }
  }
  check("半径いっぱいまで消える", seen > 40000, `${seen} ブロック`);
  check("1tickあたりの負荷に上限がかかっている", peak <= 2400, `最大 ${peak} ブロック/tick`);
  check("数秒で終わる", last < 260, `${last} tick (${(last / 20).toFixed(1)}秒)`);
}

/* ------------------------------------------------------------------ */
console.log("\n地殻貫通TNT: 岩盤付近まで掘り抜くこと");
{
  const dim = makeDimension();
  for (let dx = -12; dx <= 12; dx++)
    for (let dz = -12; dz <= 12; dz++)
      for (let y = -64; y <= 90; y++)
        dim.setBlock({ x: 1000 + dx, y, z: dz }, y === -64 ? "minecraft:bedrock" : "minecraft:stone");
  dim.setBlock({ x: 1000, y: 64, z: 0 }, "manytnt:drill_tnt");
  vanillaExplosionAt(dim, { x: 1000, y: 64, z: 2 });
  system.advance(400);

  check("真下が深くまで貫通している",
        dim.blockAt({ x: 1000, y: -40, z: 0 }) === "minecraft:air",
        dim.blockAt({ x: 1000, y: -40, z: 0 }));
  check("岩盤は残る", dim.blockAt({ x: 1000, y: -64, z: 0 }) === "minecraft:bedrock");
  check("穴に太さがある", dim.blockAt({ x: 1007, y: 40, z: 0 }) === "minecraft:air",
        `中心から7ブロック横: ${dim.blockAt({ x: 1007, y: 40, z: 0 })}`);
}

/* ------------------------------------------------------------------ */
console.log("\n崩落TNT: 地形を砂に変えて崩すこと");
{
  const dim = makeDimension();
  for (let dx = -20; dx <= 20; dx++)
    for (let dz = -20; dz <= 20; dz++)
      for (let dy = -12; dy <= 18; dy++)
        dim.setBlock({ x: 1100 + dx, y: 64 + dy, z: dz }, "minecraft:stone");
  dim.setBlock({ x: 1100, y: 64, z: 0 }, "manytnt:collapse_tnt");
  vanillaExplosionAt(dim, { x: 1100, y: 64, z: 2 });
  system.advance(400);

  let sand = 0;
  let hollow = 0;
  for (let dx = -18; dx <= 18; dx += 2) {
    for (let dz = -18; dz <= 18; dz += 2) {
      if (dim.blockAt({ x: 1100 + dx, y: 70, z: dz }) === "minecraft:sand") sand++;
      if (dim.blockAt({ x: 1100 + dx, y: 57, z: dz }) === "minecraft:air") hollow++;
    }
  }
  check("上の地形が砂に変わる", sand > 100, `${sand} 箇所`);
  check("足元がくり抜かれて落ちる先ができる", hollow > 20, `${hollow} 箇所`);
}

/* ------------------------------------------------------------------ */
console.log("\n増殖TNT: 増えるが暴走しないこと");
{
  const dim = makeDimension();
  dim.setBlock({ x: 1200, y: 64, z: 0 }, "manytnt:replicator_tnt");
  vanillaExplosionAt(dim, { x: 1200, y: 64, z: 2 });
  system.advance(1200);

  const total = dim.spawned.filter((e) => e.typeId === PRIMED_TNT).length;
  check("実際に増える", total > 5, `${total} 回爆発した`);
  // 上限は 1 (最初) + REPLICATION_LIMIT。連鎖上限にも守られている
  check("際限なく増え続けない", total <= 60, `${total} 回で止まった`);
}

/* ------------------------------------------------------------------ */
console.log("\n時間停止TNT: 止めてから一斉に解放すること");
{
  const held = { x: 1305, y: 64, z: 0 };
  let damage = 0;
  const victim = {
    typeId: "minecraft:zombie",
    location: { ...held },
    teleport(loc) { this.location = { ...loc }; },
    tryTeleport(loc) { this.location = { ...loc }; return true; },
    addEffect() {}, applyImpulse() {}, applyKnockback() {},
    applyDamage(n) { damage += n; },
    getTags: () => [],
  };
  const dim = makeDimension([victim]);
  dim.setBlock({ x: 1300, y: 64, z: 0 }, "manytnt:timestop_tnt");
  vanillaExplosionAt(dim, { x: 1300, y: 64, z: 2 });

  system.advance(60);
  // 止まっている間に動かそうとしても、元の位置に戻される
  victim.location = { x: 1350, y: 90, z: 40 };
  system.advance(20);
  const heldStill = Math.abs(victim.location.x - held.x) < 0.001;
  const duringDamage = damage;
  check("止まっている間は動けない", heldStill, `x=${victim.location.x}`);
  check("止まっている間はダメージが来ない", duringDamage === 0, `${duringDamage}`);

  system.advance(200);
  check("時が動き出すとまとめてダメージが入る", damage > 0, `${damage}`);
}

/* ------------------------------------------------------------------ */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);
if (failed.length) {
  console.error(`失敗: ${failed.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
