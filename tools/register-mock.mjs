/**
 * import "@minecraft/server" をテスト用モックに差し替え、
 * さらに BP/scripts/main.js を (package.json 無しでも) ES モジュールとして読ませる。
 *   使い方: node --import ./tools/register-mock.mjs tools/test.mjs
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const mockUrl = pathToFileURL(path.join(here, "mock-minecraft-server.mjs")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@minecraft/server") return { url: mockUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.includes("/BP/scripts/") && url.endsWith(".js")) {
      return nextLoad(url, { ...context, format: "module" });
    }
    return nextLoad(url, context);
  },
});
