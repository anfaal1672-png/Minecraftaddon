import { register } from "node:module";

// attempt() で握りつぶした例外もテストでは見えるようにする
globalThis.__MANYTNT_DEBUG__ = true;
register("./loader.mjs", import.meta.url);
