/**
 * 効果そのものの動き。
 *
 * 68個すべてを一度は走らせて、例外を握り潰していないか確かめる。
 * 「何も起きない」TNTを見つけるため、走らせた後に世界が何かしら
 * 変わっていることも見る。
 */
import { expect, suite, test } from "./harness.mjs";
import { world } from "./mock/server.mjs";
import { failureReport, freshWorld, system } from "./setup.mjs";
import { EFFECTS } from "../../BP/scripts/effects/index.js";
import { ALL_CONFIGS } from "../../BP/scripts/core/registry.js";
import { NUKE_TIERS } from "../../BP/scripts/effects/nuclear.js";
import { REPLICATION_LIMIT, replicationBudget } from "../../BP/scripts/effects/chaos.js";
import { CROP_STATES } from "../../BP/scripts/effects/terrain.js";

const CENTER = { x: 0.5, y: 64, z: 0.5 };

/** 効果を1つ動かして、世界がどう変わったかを返す */
function runEffect(name, prepare = null) {
  const dim = freshWorld();
  dim.fill({ x: -40, y: 40, z: -40 }, { x: 40, y: 63, z: 40 }, "minecraft:stone");
  dim.fill({ x: -40, y: 63, z: -40 }, { x: 40, y: 63, z: 40 }, "minecraft:grass_block");
  const player = dim.spawnEntity("minecraft:player", { x: 2, y: 64, z: 0 });
  const cow = dim.spawnEntity("minecraft:cow", { x: -2, y: 64, z: 0 });
  if (prepare) prepare(dim);

  const before = { blocks: dim._blocks.size, entities: dim._entities.length };
  EFFECTS[name](dim, CENTER, ALL_CONFIGS.find((c) => c.effect === name));
  system.advance(200);
  system.drain(600);

  return {
    dim,
    player,
    cow,
    before,
    changedBlocks: dim._blocks.size !== before.blocks,
    spawned: dim._entities.length - before.entities,
    particles: dim.particles.length,
    sounds: dim.sounds.length,
    explosions: dim.explosions.length,
    effectsGiven: player.effects.length + cow.effects.length,
    damage: player.damage.length + cow.damage.length,
    messages: world._messages.length,
  };
}

suite("効果の総当たり", () => {
  const names = Object.keys(EFFECTS).sort();

  test(`${names.length} 個すべてが例外なく動く`, () => {
    const broken = [];
    for (const name of names) {
      try {
        runEffect(name);
      } catch (err) {
        broken.push(`${name}: ${err.message}`);
      }
    }
    expect.deepEqual(broken, []);
  });

  test("どの効果も必ず何かを起こす", () => {
    // 「爆発したのに一切何も起きない」を見逃さないための網。
    const silent = [];
    for (const name of names) {
      const result = runEffect(name);
      const didSomething =
        result.changedBlocks || result.spawned !== 0 || result.particles > 0 ||
        result.sounds > 0 || result.explosions > 0 || result.effectsGiven > 0 ||
        result.damage > 0 || result.messages > 0 || result.dim.commands.length > 0 ||
        world._weather !== null;
      if (!didSomething) silent.push(name);
    }
    expect.deepEqual(silent, []);
  });

  test("握り潰した例外が残っていない", () => {
    freshWorld();
    for (const name of names) runEffect(name);
    const noisy = failureReport().filter(([label]) => !label.startsWith("jobs:"));
    expect.deepEqual(noisy.map(([label, count]) => `${label}×${count}`), []);
  });
});

suite("個別の挙動", () => {
  test("嵐TNTが天候を変える", () => {
    // 以前は列挙値が小文字で、例外になって一度も天候が変わらなかった
    runEffect("stormEffect");
    expect.ok(world._weather, "天候が変わっていない");
    expect.equal(world._weather.type, "Thunder");
  });

  test("豊作TNTがネザーウォートも育てる", () => {
    // ネザーウォートだけ growth ではなく age を使う
    const result = runEffect("harvestEffect", (dim) => {
      dim._setBlock(0, 64, 0, "minecraft:nether_wart", { age: 0 });
      dim._setBlock(1, 64, 0, "minecraft:beetroot", { growth: 0 });
      dim._setBlock(2, 64, 0, "minecraft:wheat", { growth: 2 });
    });
    expect.equal(result.dim.getBlock({ x: 0, y: 64, z: 0 }).permutation.getState("age"), CROP_STATES["minecraft:nether_wart"].max);
    expect.equal(result.dim.getBlock({ x: 1, y: 64, z: 0 }).permutation.getState("growth"), 7);
    expect.equal(result.dim.getBlock({ x: 2, y: 64, z: 0 }).permutation.getState("growth"), 7);
  });

  test("津波TNTは元からあった水を消さない", () => {
    const result = runEffect("tsunamiEffect", (dim) => {
      dim._setBlock(3, 64, 3, "minecraft:water");
    });
    expect.equal(result.dim.getBlock({ x: 3, y: 64, z: 3 }).typeId, "minecraft:water");
  });

  test("黒曜石TNTは溶岩が無くても殻を作る", () => {
    const result = runEffect("obsidianEffect");
    let obsidian = 0;
    for (const [, value] of result.dim._blocks) if (value.typeId === "minecraft:obsidian") obsidian++;
    expect.atLeast(obsidian, 20, "黒曜石が置かれていない");
  });

  test("サボテンTNTは草原でも生える", () => {
    const result = runEffect("cactusEffect");
    let cactus = 0;
    for (const [, value] of result.dim._blocks) if (value.typeId === "minecraft:cactus") cactus++;
    expect.atLeast(cactus, 1, "草原で1本も生えていない");
  });

  test("草原TNTは土の上にも花を咲かせる", () => {
    const result = runEffect("grassEffect", (dim) => {
      dim.fill({ x: -6, y: 63, z: -6 }, { x: 6, y: 63, z: 6 }, "minecraft:dirt");
    });
    let plants = 0;
    for (const [, value] of result.dim._blocks) {
      if (value.typeId.includes("grass") && value.typeId !== "minecraft:grass_block") plants++;
      if (["minecraft:poppy", "minecraft:dandelion", "minecraft:allium"].includes(value.typeId)) plants++;
    }
    expect.atLeast(plants, 1, "土の上に何も生えていない");
  });

  test("運試しTNTは存在しない効果を使わない", () => {
    // minecraft:unluck は統合版に無い。使うと例外になって何も付かない
    for (let i = 0; i < 20; i++) {
      const result = runEffect("fortuneEffect");
      const applied = result.player.effects.map((e) => e.effectId);
      expect.ok(!applied.includes("minecraft:unluck"), "存在しない効果を使っている");
    }
  });

  test("打ち上げ系はプレイヤーにも効く", () => {
    // applyImpulse はプレイヤーに使えない。それに気づかず使うと
    // 同じ try の中の addEffect まで巻き添えで飛ぶ
    const result = runEffect("antiGravityEffect");
    expect.atLeast(result.player.knockbacks.length, 1, "プレイヤーが押されていない");
    const applied = result.player.effects.map((e) => e.effectId);
    expect.includes(applied, "minecraft:levitation");
  });

  test("虹TNTは核を引かない", () => {
    // 威力6の中堅TNTが巨大クレーターを作ってしまわないこと
    for (let i = 0; i < 40; i++) {
      const result = runEffect("rainbowEffect");
      expect.atMost(result.dim.explosions.length, 6, "核級の爆発が混ざっている");
    }
  });

  test("核系の段階が強さの順に並んでいる", () => {
    const order = ["nuke", "ultraNuke", "hydrogenBomb", "tsarBomba", "antimatter"];
    for (let i = 1; i < order.length; i++) {
      const prev = NUKE_TIERS[order[i - 1]];
      const next = NUKE_TIERS[order[i]];
      expect.ok(next.blastRadius > prev.blastRadius, `${order[i]} の半径が前より小さい`);
      expect.ok(next.maxDamage > prev.maxDamage, `${order[i]} の威力が前より小さい`);
    }
  });

  test("増殖TNTは上限で止まる", () => {
    const dim = freshWorld();
    dim.fill({ x: -20, y: 60, z: -20 }, { x: 20, y: 63, z: 20 }, "minecraft:stone");
    let placed = 0;
    for (let i = 0; i < 60; i++) {
      const before = countTnt(dim);
      EFFECTS.replicatorEffect(dim, { x: (i % 9) * 4 - 16, y: 64, z: Math.floor(i / 9) * 4 - 12 });
      placed += countTnt(dim) - before;
    }
    expect.atMost(placed, REPLICATION_LIMIT, "上限を超えて増えている");
    expect.equal(replicationBudget(), 0, "上限まで使い切るはず");
  });
});

function countTnt(dim) {
  let n = 0;
  for (const [, value] of dim._blocks) if (value.typeId === "manytnt:replicator_tnt") n++;
  return n;
}
