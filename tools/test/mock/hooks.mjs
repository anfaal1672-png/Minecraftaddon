/** 読み込みフックの本体。loader.mjs から登録される */
import { pathToFileURL } from "node:url";

const MOCKS = {
  "@minecraft/server": pathToFileURL("./tools/test/mock/server.mjs").href,
  "@minecraft/server-ui": pathToFileURL("./tools/test/mock/server-ui.mjs").href,
};

export function resolve(specifier, context, nextResolve) {
  const mock = MOCKS[specifier];
  if (mock) return { url: mock, shortCircuit: true };
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  // BP/scripts の .js は ES モジュールとして読む
  if (url.includes("/BP/scripts/") && url.endsWith(".js")) {
    return nextLoad(url, { ...context, format: "module" });
  }
  return nextLoad(url, context);
}
