import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LOOKS, STANDARD_SURFACE_ALPHAS, lookOf, panelOpacities, releasedLooks, surfaceAlphas, surfaceAlphaStyle } from "../src/domain/looks.ts";
import { declarationsOf } from "./harness/compiledCss.ts";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} is not ${expected}`);

describe("the game's panel opacities", () => {
  it("run from opaque at 0% through 0.4375 and 0.600 at the default to 0.25 and 0.374", () => {
    // The game's own index.js, for its Interface transparency slider.
    close(panelOpacities(0).normal, 1);
    close(panelOpacities(0).dark, 1);
    close(panelOpacities(0.5).normal, 0.4375);
    close(panelOpacities(0.5).dark, 0.6);
    close(panelOpacities(1).normal, 0.25);
    close(panelOpacities(1).dark, 0.374);
  });
});

describe("a look's panels under the game's transparency", () => {
  it("draw as the look draws them at the game's default", () => {
    assert.deepEqual(surfaceAlphas(0.5), { ...STANDARD_SURFACE_ALPHAS });
  });

  it("turn opaque at 0%, never past opaque", () => {
    // Scaled plainly, the head would ask for 1.6 and the list for 2.1.
    assert.deepEqual(surfaceAlphas(0), { head: 1, body: 1, popBg: 1 });
  });

  it("keep a little over half their alpha at 100%", () => {
    const alphas = surfaceAlphas(1);

    close(alphas.head, 0.598);
    close(alphas.body, 0.526);
    close(alphas.popBg, 0.604);
  });

  it("draw as the look draws them while the game has not said", () => {
    assert.deepEqual(surfaceAlphas(Number.NaN), { ...STANDARD_SURFACE_ALPHAS });
  });

  it("reach the root as the custom properties the panel tokens read", () => {
    assert.deepEqual(surfaceAlphaStyle(0.5), { "--bbm-a-head": "0.96", "--bbm-a-body": "0.92", "--bbm-a-popBg": "0.97" });
  });

  it("start at the alphas each look's stylesheet declares, before the root says", () => {
    for (const look of releasedLooks()) {
      const own = declarationsOf("looks/looks.module.scss", `.${look.id}`);

      for (const [surface, alpha] of Object.entries(look.alphas)) {
        assert.equal(Number(own[`--bbm-a-${surface}`]), alpha, `${look.id} ${surface}`);
      }
    }
  });

  it("scale a look's own alphas, Plates' as Standard's", () => {
    assert.deepEqual(lookOf("plates").alphas, STANDARD_SURFACE_ALPHAS);
    assert.deepEqual(surfaceAlphas(0.5, { head: 0.9, body: 0.8, popBg: 0.95 }), { head: 0.9, body: 0.8, popBg: 0.95 });
    assert.deepEqual(surfaceAlphaStyle(0, lookOf("plates").alphas), { "--bbm-a-head": "1", "--bbm-a-body": "1", "--bbm-a-popBg": "1" });
  });
});

describe("the looks", () => {
  it("are the five the settings name, of which the Look row offers the finished ones, Standard first", () => {
    assert.deepEqual(LOOKS.map((look) => look.id), ["standard", "glass", "plates", "line", "cards"]);
    assert.deepEqual(releasedLooks().map((look) => look.id), ["standard", "plates"]);
  });

  it("draw a finished look as itself, and anything else, an unfinished look included, as Standard", () => {
    assert.equal(lookOf("plates").id, "plates");
    assert.equal(lookOf("standard").id, "standard");
    for (const other of ["glass", "cards", "Plates", "", undefined]) assert.equal(lookOf(other).id, "standard", String(other));
  });
});

describe("a look's unit marks", () => {
  it("are read in one place, useUnitMarks, which every body, the readout and the hover card take them from", () => {
    const src = new URL("../src/", import.meta.url);
    const readers = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && /\.units\b/.test(readFileSync(new URL(file, src), "utf8")))
      .map((file) => file.replaceAll("\\", "/"));

    assert.deepEqual(readers, ["mods/Bodies/useBodyWords.ts"]);
  });
});
