import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NOTCH_TOP_WIDTH } from "../src/domain/assetMenuLayout.ts";
import { notchLeft } from "../src/domain/notch.ts";
import { findLitToolbarButton } from "../src/mods/BuildingMenu/vanillaLayout.ts";
import { FakeElement } from "./harness/fakeElement.ts";
import { resetModules, setModule } from "./harness/stubs/cs2-modding";

const globals = globalThis as unknown as Record<string, unknown>;
/** A rem in a 720-pixel-tall page, as the game's 1280 × 720 UI draws it: a screen is 1,080 rem tall. */
const px = (rem: number) => (rem * 720) / 1080;
const near = (actual: number | null, expected: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);

/** Roads' lit button, over the box at its first step. */
const roads = { buttonLeftPx: px(900.2), buttonWidthPx: px(38.4), boxLeftPx: px(604), boxWidth: 706, innerHeight: 720 };

describe("where the notch sits", () => {
  it("is centred on the lit bar button, in rem from the box's left edge", () => {
    near(NOTCH_TOP_WIDTH, 38.4);
    // The notch's top is centred on the button's centre, measured from the box's left edge.
    near(notchLeft(roads), 296.2);
  });

  it("is held inside the box's ends", () => {
    // A button right of the box at the first step, as Landscaping's: the notch takes the box's right end.
    near(notchLeft({ ...roads, buttonLeftPx: px(1400) }), 706 - 38.4);
    near(notchLeft({ ...roads, buttonLeftPx: px(500) }), 0);
  });

  it("is held inside the box's span as its rectangle measures it, and its drawn width before that", () => {
    // A box drawn narrower than its width says: the measured span is the one the notch stays in.
    near(notchLeft({ ...roads, buttonLeftPx: px(1400), boxWidthPx: px(500) }), 500 - 38.4);
    // A rectangle not laid out yet measures nothing, so the drawn width holds.
    near(notchLeft({ ...roads, buttonLeftPx: px(1400), boxWidthPx: 0 }), 706 - 38.4);
  });

  it("is nowhere while a rectangle reads as unmeasured", () => {
    // Cohtml answers a rectangle asked for before layout with zeroes.
    assert.equal(notchLeft({ ...roads, buttonWidthPx: 0 }), null);
    assert.equal(notchLeft({ ...roads, innerHeight: 0 }), null);
    assert.equal(notchLeft({ ...roads, boxLeftPx: Number.NaN }), null);
  });
});

// The stubbed stylesheet modules answer each class as "vanilla-<key>".
const LIT = ".vanilla-toolbarButtonStrip button.selected";

describe("the lit bar button", () => {
  const saved = globals.HTMLElement;

  before(() => {
    globals.HTMLElement = FakeElement;
  });

  after(() => {
    globals.HTMLElement = saved;
    resetModules();
  });

  it("is the button the game lights in the bar's button strip", () => {
    const lit = new FakeElement(["selected"]);
    const toolbar = new FakeElement(["vanilla-toolbar"]);
    toolbar.found[LIT] = lit;
    const screen = new FakeElement(["vanilla-gameMainScreen"], [new FakeElement(["vanilla-mainContainer"]), toolbar]);
    const doc = { querySelector: (selector: string) => (selector === ".vanilla-gameMainScreen" ? screen : null) };

    assert.equal(findLitToolbarButton(doc as unknown as Document), lit);
  });

  it("is nothing without the bar or a lit button", () => {
    assert.equal(findLitToolbarButton({ querySelector: () => null } as unknown as Document), null);

    const screen = new FakeElement(["vanilla-gameMainScreen"], [new FakeElement(["vanilla-toolbar"])]);
    assert.equal(findLitToolbarButton({ querySelector: () => screen } as unknown as Document), null);
  });

  it("is nothing, without searching the bar, when the game names no button strip class", () => {
    const toolbar = new FakeElement(["vanilla-toolbar"]);
    toolbar.found[LIT] = new FakeElement(["selected"]);
    let searched = 0;
    const search = toolbar.querySelector.bind(toolbar);
    toolbar.querySelector = (selector) => {
      searched += 1;
      return search(selector);
    };
    const screen = new FakeElement(["vanilla-gameMainScreen"], [toolbar]);
    setModule("game-ui/game/components/toolbar/top/toolbar-button-strip/toolbar-button-strip.module.scss", "classes", {});

    try {
      assert.equal(findLitToolbarButton({ querySelector: () => screen } as unknown as Document), null);
      assert.equal(searched, 0, "the bar is not searched for a class the game does not name");
    } finally {
      resetModules();
    }
  });
});
