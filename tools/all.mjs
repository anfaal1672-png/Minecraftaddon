/**
 * 生成 → 検査 → テスト → 配布物、をひととおり通す。
 *   実行: node tools/all.mjs
 */
import { execFileSync } from "node:child_process";
import { at } from "./lib/io.mjs";

const steps = [
  ["生成", ["tools/build.mjs"]],
  ["検査", ["tools/check.mjs"]],
  ["テスト", ["--import", "./tools/test/mock/loader.mjs", "tools/test.mjs"]],
  ["配布物", ["tools/pack.mjs"]],
];

for (const [name, args] of steps) {
  console.log(`\n───── ${name} ─────`);
  try {
    execFileSync(process.execPath, args, { cwd: at("."), stdio: "inherit" });
  } catch (err) {
    console.error(`\n❌ ${name} で失敗した`);
    process.exit(1);
  }
}
console.log("\n✅ すべて通った");
