/**
 * テストをまとめて走らせる。
 *   実行: node --import ./tools/test/mock/loader.mjs tools/test.mjs
 *
 * @minecraft/server は tools/test/mock/ の代役に差し替わるので、
 * ゲームを起動せずに着火から爆発、地形の書き換えまで一通り確かめられる。
 */
import { runAll } from "./test/harness.mjs";

await import("./test/registry.test.mjs");
await import("./test/ignition.test.mjs");
await import("./test/terrain.test.mjs");
await import("./test/effects.test.mjs");
await import("./test/ui.test.mjs");
await import("./test/expansion.test.mjs");

process.exit((await runAll()) ? 0 : 1);
