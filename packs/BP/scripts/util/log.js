/* ------------------------------------------------------------------ */
/*  ログ出力。                                                         */
/*  想定外のエラーは warn() で必ずコンテンツログに出す。                  */
/*  未ロードのチャンクなど「起きて当然」の失敗は debug() に流し、        */
/*  DEBUG を true にしたときだけ表示する (B24: 黙って握りつぶさない)。    */
/* ------------------------------------------------------------------ */
// ゲーム内では常に false。テスト (test/setup.mjs) のときだけ有効になる。
export const DEBUG = globalThis.__MANYTNT_DEBUG__ === true;

export function warn(where, err) {
  try {
    console.warn(`[manytnt] ${where}: ${err}`);
  } catch (_) {
    /* console が使えない環境では何もしない */
  }
}

export function debug(where, err) {
  if (DEBUG) warn(where, err);
}

/** fn を実行し、例外は warn してから undefined を返す */
export function guard(where, fn) {
  try {
    return fn();
  } catch (err) {
    warn(where, err);
    return undefined;
  }
}

/** fn を実行し、例外は debug 扱いにする (失敗しても問題ない処理用) */
export function attempt(where, fn) {
  try {
    return fn();
  } catch (err) {
    debug(where, err);
    return undefined;
  }
}
