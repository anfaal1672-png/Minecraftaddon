// @minecraft/* の import をテスト用モックに差し替える。
const MOCKS = {
  "@minecraft/server": new URL("./mocks/server.mjs", import.meta.url).href,
  "@minecraft/server-ui": new URL("./mocks/server-ui.mjs", import.meta.url).href,
};

export async function resolve(specifier, context, next) {
  if (MOCKS[specifier]) return { url: MOCKS[specifier], shortCircuit: true };
  return next(specifier, context);
}
