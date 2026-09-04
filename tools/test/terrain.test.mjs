/** 地形の掘削とジョブの捌き方 */
import { expect, suite, test } from "./harness.mjs";
import { world } from "./mock/server.mjs";
import { countAir, detonate, freshWorld, placeTnt, solidGround, system } from "./setup.mjs";
import { carveSphere, carveShaft } from "../../BP/scripts/lib/terrain.js";
import { jobStats, MAX_CONCURRENT, submit } from "../../BP/scripts/core/jobs.js";
import { sphereColumns } from "../../BP/scripts/lib/shapes.js";
import { set } from "../../BP/scripts/core/settings.js";

suite("掘削の形", () => {
  test("爆心地より上も下も同じだけ壊れる", () => {
    const dim = freshWorld();
    dim.fill({ x: -30, y: 34, z: -30 }, { x: 30, y: 94, z: 30 }, "minecraft:stone");
    const center = { x: 0, y: 64, z: 0 };
    carveSphere(dim, center, { radius: 12 });
    system.drain();

    let above = 0;
    let below = 0;
    for (let d = 1; d <= 10; d++) {
      if (dim.getBlock({ x: 0, y: 64 + d, z: 0 }).isAir) above++;
      if (dim.getBlock({ x: 0, y: 64 - d, z: 0 }).isAir) below++;
    }
    expect.atLeast(above, 8, "上が壊れていない");
    expect.atLeast(below, 8, "下が壊れていない");
  });

  test("球の形をしている (中心が厚く外ほど薄い)", () => {
    const dim = freshWorld();
    dim.fill({ x: -30, y: 34, z: -30 }, { x: 30, y: 94, z: 30 }, "minecraft:stone");
    carveSphere(dim, { x: 0, y: 64, z: 0 }, { radius: 16 });
    system.drain();

    const columnHeight = (x, z) => {
      let n = 0;
      for (let y = 40; y <= 90; y++) if (dim.getBlock({ x, y, z }).isAir) n++;
      return n;
    };
    const middle = columnHeight(0, 0);
    const mid = columnHeight(9, 0);
    const edge = columnHeight(14, 0);
    expect.ok(middle > mid && mid > edge, `中心から外へ薄くなるはず (${middle} > ${mid} > ${edge})`);
    expect.between(middle, 26, 36, "中心の厚みは直径ぶん (32±)");
  });

  test("岩盤と水は消さない", () => {
    const dim = freshWorld();
    dim.fill({ x: -8, y: 60, z: -8 }, { x: 8, y: 68, z: 8 }, "minecraft:stone");
    dim._setBlock(2, 64, 0, "minecraft:bedrock");
    dim._setBlock(-2, 64, 0, "minecraft:water");
    carveSphere(dim, { x: 0, y: 64, z: 0 }, { radius: 6 });
    system.drain();
    expect.equal(dim.getBlock({ x: 2, y: 64, z: 0 }).typeId, "minecraft:bedrock");
    expect.equal(dim.getBlock({ x: -2, y: 64, z: 0 }).typeId, "minecraft:water");
  });

  test("縦穴は指定した深さまで届く", () => {
    const dim = freshWorld();
    dim.fill({ x: -12, y: 0, z: -12 }, { x: 12, y: 80, z: 12 }, "minecraft:stone");
    carveShaft(dim, { x: 0, y: 70, z: 0 }, { radius: 4, top: 4, bottom: -50 });
    system.drain();
    expect.ok(dim.getBlock({ x: 0, y: 74, z: 0 }).isAir, "上端まで掘れていない");
    expect.ok(dim.getBlock({ x: 0, y: 20, z: 0 }).isAir, "下端まで掘れていない");
    expect.ok(!dim.getBlock({ x: 0, y: 19, z: 0 }).isAir, "指定より下まで掘っている");
  });

  test("半径から作られる柱の数が球の断面積と釣り合う", () => {
    const columns = sphereColumns(20, { jitter: 0, ragged: 1 });
    // πr² ≈ 1257
    expect.between(columns.length, 1150, 1350);
    expect.equal(columns[0].frac, 0, "中心から並ぶはず");
  });
});

suite("ジョブの捌き方", () => {
  test("同時に走るジョブ数に上限がある", () => {
    freshWorld();
    let started = 0;
    for (let i = 0; i < 10; i++) {
      submit(`test${i}`, function* () {
        started++;
        for (let n = 0; n < 50; n++) yield;
      });
    }
    expect.equal(jobStats().running, MAX_CONCURRENT, "上限ぶんだけ走るはず");
    expect.equal(jobStats().queued, 10 - MAX_CONCURRENT);
    // ジェネレータは1tick進めて初めて動き出す
    system.advance(1);
    expect.equal(started, MAX_CONCURRENT, "走り出すのも上限ぶんだけ");
  });

  test("順番待ちがすべて片付く", () => {
    freshWorld();
    let done = 0;
    for (let i = 0; i < 8; i++) {
      submit(`test${i}`, function* () {
        for (let n = 0; n < 20; n++) yield;
      }, { onDone: () => done++ });
    }
    system.drain();
    expect.equal(done, 8);
    expect.equal(jobStats().queued, 0);
    expect.equal(jobStats().running, 0);
  });

  test("ジョブの中で例外が出ても他のジョブは進む", () => {
    freshWorld();
    let finished = 0;
    submit("boom", function* () {
      yield;
      throw new Error("わざと失敗させる");
    }, { onDone: () => finished++ });
    submit("fine", function* () {
      for (let n = 0; n < 5; n++) yield;
    }, { onDone: () => finished++ });
    system.drain();
    expect.equal(finished, 2, "失敗しても後始末は走るはず");
  });

  test("同時に何発爆発しても走るジョブ数は変わらない", () => {
    const dim = freshWorld();
    dim.fill({ x: -60, y: 30, z: -60 }, { x: 60, y: 90, z: 60 }, "minecraft:stone");
    for (let i = 0; i < 6; i++) {
      carveSphere(dim, { x: i * 12 - 30, y: 60, z: 0 }, { radius: 8 });
    }
    expect.equal(jobStats().running, MAX_CONCURRENT);
    system.drain();
    expect.equal(jobStats().running, 0);
  });
});

suite("設定と破壊", () => {
  test("地形の破壊を切ると1ブロックも壊れない", () => {
    const dim = freshWorld();
    solidGround(dim);
    set("terrain", false);
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "nuke_tnt");
    detonate(dim, { x: 0, y: 64, z: 0 });
    system.drain();

    for (const explosion of dim.explosions) {
      expect.equal(explosion.breaksBlocks, false, "破壊つきの爆発が起きている");
    }
    // TNTブロック自身が消えるぶんだけを許す
    expect.atMost(countAir(dim, { x: 0, y: 64, z: 0 }, 10), 1);
  });

  test("ゲームルール tntExplodes を切ると壊さない", () => {
    const dim = freshWorld();
    solidGround(dim);
    dim.explosions.length = 0;
    world.gameRules.tntExplodes = false;
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mega_tnt");
    detonate(dim, { x: 0, y: 64, z: 0 });
    expect.equal(dim.explosions[0].breaksBlocks, false);
    world.gameRules.tntExplodes = true;
  });

  test("規模の倍率が掘削の半径に効く", () => {
    const dim = freshWorld();
    dim.fill({ x: -40, y: 30, z: -40 }, { x: 40, y: 90, z: 40 }, "minecraft:stone");
    set("scale", 0.5);
    placeTnt(dim, { x: 0, y: 60, z: 0 }, "nuke_tnt");
    detonate(dim, { x: 0, y: 60, z: 0 });
    system.drain();
    // 半径24 の半分 = 12。24ブロック先はまだ石のはず
    expect.ok(!dim.getBlock({ x: 20, y: 60, z: 0 }).isAir, "倍率が効いていない");
    expect.ok(dim.getBlock({ x: 4, y: 60, z: 0 }).isAir, "中心付近は壊れるはず");
  });
});
