import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { transformSync } from "@swc/core";
import * as sass from "sass";

const UI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(UI_ROOT, "src");
const STUBS = path.join(UI_ROOT, "test", "harness", "stubs");
const EXTENSIONS = [".tsx", ".ts", ".js", ".mjs"];

function withExtension(file) {
  if (existsSync(file) && !file.endsWith("/")) return file;
  for (const ext of EXTENSIONS) if (existsSync(file + ext)) return file + ext;
  for (const ext of EXTENSIONS) if (existsSync(path.join(file, "index" + ext))) return path.join(file, "index" + ext);
  return null;
}

export async function resolve(specifier, context, next) {
  // The game's runtime modules, stubbed.
  const cs2 = specifier.match(/^cs2\/([a-z0-9]+)$/);
  if (cs2) return { url: pathToFileURL(path.join(STUBS, `cs2-${cs2[1]}.tsx`)).href, shortCircuit: true };

  // The bundler's baseUrl=src aliases.
  const aliased = specifier.match(/^(domain|mods|images)\/(.+)$/);
  if (aliased) {
    const file = withExtension(path.join(SRC, specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  // Extensionless relative imports inside src.
  if (specifier.startsWith(".") && context.parentURL && context.parentURL.startsWith("file:")) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    const file = withExtension(path.resolve(base, specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return next(specifier, context);
}

/** What a sheet's `:export` blocks hold, compiled; most sheets have none and skip sass. */
function sheetExports(file) {
  if (!file.endsWith(".scss") || !readFileSync(file, "utf8").includes(":export")) return {};

  const exported = {};
  const { css } = sass.compile(file, { loadPaths: [SRC], logger: sass.Logger.silent });
  for (const [, body] of css.matchAll(/:export\s*\{([^}]*)\}/g)) {
    for (const declaration of body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon > 0) exported[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
  }

  return exported;
}

export async function load(url, context, next) {
  if (!url.startsWith("file:")) return next(url, context);
  const file = fileURLToPath(url);

  if (file.endsWith(".scss") || file.endsWith(".css")) {
    // CSS modules: every class name is its own key, so `styles.row` is "row".
    // A value the sheet exports with ICSS `:export` is the compiled one, so
    // code that reads a size from a sheet reads the real size here too.
    const exported = JSON.stringify(sheetExports(file));
    return {
      format: "module",
      shortCircuit: true,
      source: `const exported = ${exported}; export default new Proxy({}, { get: (_, key) => (typeof key !== "string" ? "" : Object.hasOwn(exported, key) ? exported[key] : key) });`,
    };
  }
  if (file.endsWith(".svg") || file.endsWith(".png")) {
    return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(path.basename(file))};` };
  }
  if (file.endsWith(".json")) {
    return { format: "module", shortCircuit: true, source: `export default ${readFileSync(file, "utf8")};` };
  }
  if ((file.endsWith(".ts") || file.endsWith(".tsx")) && (file.startsWith(SRC) || file.startsWith(path.join(UI_ROOT, "test")))) {
    const { code } = transformSync(readFileSync(file, "utf8"), {
      filename: file,
      jsc: {
        parser: { syntax: "typescript", tsx: file.endsWith(".tsx") },
        transform: { react: { runtime: "automatic" } },
        target: "es2022",
      },
      module: { type: "es6" },
      sourceMaps: "inline",
    });
    return { format: "module", shortCircuit: true, source: code };
  }

  return next(url, context);
}
