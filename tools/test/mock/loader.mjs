/**
 * テスト実行時に @minecraft/* を代役に差し替えるための読み込みフック。
 *   実行: node --import ./tools/test/mock/loader.mjs tools/test.mjs
 *
 * BP/scripts/*.js は拡張子が .js だが中身は ES モジュールなので、
 * そのままだと Node が CommonJS として読もうとして失敗する。
 * ここで module 扱いだと伝えている。
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const HOOKS = pathToFileURL("./tools/test/mock/hooks.mjs").href;
register(HOOKS, pathToFileURL("./"));
