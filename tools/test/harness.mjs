/**
 * ごく小さなテストの枠組み。
 *
 * 外部のライブラリを入れずに済ませたいので自前。
 * 失敗したときに「何がどうだったか」が分かる形で出す。
 */
const suites = [];
let current = null;

export function suite(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function test(name, fn) {
  if (!current) throw new Error("test() は suite() の中で呼ぶこと");
  current.tests.push({ name, fn });
}

export class AssertionError extends Error {}

function fail(message) {
  throw new AssertionError(message);
}

export const expect = {
  ok(value, message = "真であるはず") {
    if (!value) fail(`${message} (実際: ${format(value)})`);
  },
  equal(actual, expected, message = "一致するはず") {
    if (actual !== expected) fail(`${message}\n    期待: ${format(expected)}\n    実際: ${format(actual)}`);
  },
  deepEqual(actual, expected, message = "同じ中身のはず") {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) fail(`${message}\n    期待: ${b}\n    実際: ${a}`);
  },
  atLeast(actual, min, message = "下回らないはず") {
    if (!(actual >= min)) fail(`${message}\n    ${format(actual)} >= ${format(min)} が成り立たない`);
  },
  atMost(actual, max, message = "上回らないはず") {
    if (!(actual <= max)) fail(`${message}\n    ${format(actual)} <= ${format(max)} が成り立たない`);
  },
  between(actual, min, max, message = "範囲に入るはず") {
    if (!(actual >= min && actual <= max)) {
      fail(`${message}\n    ${format(min)} <= ${format(actual)} <= ${format(max)} が成り立たない`);
    }
  },
  includes(haystack, needle, message = "含まれるはず") {
    const has = typeof haystack === "string" ? haystack.includes(needle) : [...haystack].includes(needle);
    if (!has) fail(`${message}\n    ${format(needle)} が ${format(haystack)} に無い`);
  },
  throws(fn, message = "例外になるはず") {
    try {
      fn();
    } catch (err) {
      return err;
    }
    fail(message);
  },
  notThrows(fn, message = "例外にならないはず") {
    try {
      fn();
    } catch (err) {
      fail(`${message}\n    ${err?.stack ?? err}`);
    }
  },
};

function format(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.slice(0, 8).map(format).join(", ")}${value.length > 8 ? ", …" : ""}]`;
  if (value && typeof value === "object") return JSON.stringify(value).slice(0, 200);
  return String(value);
}

/** 集めたテストをすべて走らせる */
export async function runAll() {
  let passed = 0;
  const failures = [];

  for (const s of suites) {
    console.log(`\n■ ${s.name}`);
    for (const t of s.tests) {
      try {
        await t.fn();
        passed++;
        console.log(`  ✅ ${t.name}`);
      } catch (err) {
        failures.push({ suite: s.name, test: t.name, err });
        console.log(`  ❌ ${t.name}`);
        const text = err instanceof AssertionError ? err.message : (err?.stack ?? String(err));
        console.log(text.split("\n").map((line) => `     ${line}`).join("\n"));
      }
    }
  }

  const total = passed + failures.length;
  console.log(`\n${passed} / ${total} 件成功`);
  if (failures.length) {
    console.log("\n失敗した項目:");
    for (const f of failures) console.log(`  ・${f.suite} › ${f.test}`);
  }
  return failures.length === 0;
}
