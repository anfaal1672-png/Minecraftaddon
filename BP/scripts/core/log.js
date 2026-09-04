/**
 * 例外の握り潰しと、その記録。
 *
 * Minecraft のスクリプトAPIは「チャンクが読み込まれていない」「その端末には
 * まだ無いAPI」といった理由で、正常な状況でもごく普通に例外を投げる。
 * そのたびに機能全体が止まらないよう、要所を try で包む必要があるのだが、
 * 素朴に書くと `catch (err) {}` がコード中に何百個も並んで読めなくなる。
 *
 * そこでここに集約する。握り潰した回数は種類ごとに数えていて、
 * /scriptevent manytnt:debug で確認できる。「何も起きない」と言われたときに
 * 何が失敗しているのか分かるので、原因を追いやすい。
 */
const failures = new Map();

/** 出しすぎ防止。同じ場所の警告は最初の数回だけコンソールに出す */
const CONSOLE_LIMIT = 3;

/**
 * 失敗してもよい処理を実行する。
 * @param {string} label どこで失敗したか (集計のキーになる)
 * @param {Function} fn 実行する処理
 * @param {*} fallback 失敗したときの戻り値
 */
export function attempt(label, fn, fallback = undefined) {
  try {
    return fn();
  } catch (err) {
    note(label, err);
    return fallback;
  }
}

/** 失敗を数える。attempt を使えない細かいループの中から直接呼ぶこともある */
export function note(label, err) {
  const count = (failures.get(label) ?? 0) + 1;
  failures.set(label, count);
  if (count <= CONSOLE_LIMIT) {
    console.warn(`[manytnt] ${label}: ${err}`);
  }
}

/** 集計結果を「多い順」に返す */
export function failureReport() {
  return [...failures.entries()].sort((a, b) => b[1] - a[1]);
}

export function clearFailures() {
  failures.clear();
}
