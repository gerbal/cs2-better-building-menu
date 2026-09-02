// `node --import ./test/harness/register.mjs --test …` — installs the loader
// hooks that let a component render under node: TSX through @swc/core, the
// bundler's aliases resolved, cs2/* replaced by stubs, stylesheets by proxies.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
