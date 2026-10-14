import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

/**
 * Every stylesheet compiles with no deprecation warning. Each one is a line in the release build's
 * output, and a rule Dart Sass 2.0 removes: a slash for division stops compiling there.
 */
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const sheets = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".scss") && !name.split("/").pop()!.startsWith("_"));

describe("the stylesheets under the Sass the build uses", () => {
  it("compile with no deprecation warning", () => {
    const warned: string[] = [];

    for (const sheet of sheets) {
      sass.compile(join(src, sheet), {
        loadPaths: [src],
        logger: {
          warn: (message, options) => {
            if (options.deprecation) warned.push(`${relative(src, join(src, sheet))}: ${message.split("\n")[0]}`);
          },
        },
      });
    }

    assert.deepEqual(warned, []);
  });
});
