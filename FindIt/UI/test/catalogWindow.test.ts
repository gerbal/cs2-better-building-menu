import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_WINDOW_SCROLL_THRESHOLD,
  nextWindowLimit,
  shouldLoadMore,
} from "../src/domain/catalogWindow.ts";
import { BUILDING_LENS_MIN_CATALOG_HEIGHT } from "../src/domain/buildingLensLayout.ts";

describe("when the growing window asks for more", () => {
  it("asks once the viewport bottom is inside the threshold band", () => {
    assert.equal(
      shouldLoadMore({ scrollTop: 1800, clientHeight: 600, scrollHeight: 2500, threshold: 200 }),
      true,
    );
  });

  it("stays quiet in the middle of the content", () => {
    assert.equal(
      shouldLoadMore({ scrollTop: 400, clientHeight: 600, scrollHeight: 2500, threshold: 200 }),
      false,
    );
  });

  it("treats the threshold as inclusive so the last pixel is not a dead zone", () => {
    assert.equal(
      shouldLoadMore({ scrollTop: 1700, clientHeight: 600, scrollHeight: 2500, threshold: 200 }),
      true,
    );
    assert.equal(
      shouldLoadMore({ scrollTop: 1699, clientHeight: 600, scrollHeight: 2500, threshold: 200 }),
      false,
    );
  });

  it("says no for a container that has not been laid out yet", () => {
    // A container measured before layout reports every metric as zero, which
    // reads as "scrolled to the bottom" and would fetch on mount, forever.
    assert.equal(shouldLoadMore({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 }), false);
  });

  it("says no when the content is shorter than the viewport", () => {
    // Nothing can scroll here, so nothing can change the answer: a true would
    // repeat on every render with no scroll event to end it.
    assert.equal(
      shouldLoadMore({ scrollTop: 0, clientHeight: 600, scrollHeight: 400, threshold: 200 }),
      false,
    );
    assert.equal(
      shouldLoadMore({ scrollTop: 0, clientHeight: 600, scrollHeight: 600, threshold: 200 }),
      false,
    );
  });

  it("says no rather than guessing when a measurement is not a number", () => {
    assert.equal(
      shouldLoadMore({ scrollTop: Number.NaN, clientHeight: 600, scrollHeight: 2500 }),
      false,
    );
    assert.equal(
      shouldLoadMore({ scrollTop: 1800, clientHeight: Number.NaN, scrollHeight: 2500 }),
      false,
    );
    assert.equal(
      shouldLoadMore({ scrollTop: 1800, clientHeight: 600, scrollHeight: Number.NaN }),
      false,
    );
    assert.equal(
      shouldLoadMore({ scrollTop: 1800, clientHeight: 600, scrollHeight: 2500, threshold: Number.NaN }),
      true,
    );
  });

  it("falls back to the shared threshold when the caller does not name one", () => {
    const scrollHeight = 4000;
    const clientHeight = 600;
    const bottom = scrollHeight - clientHeight;

    assert.equal(
      shouldLoadMore({ scrollTop: bottom - CATALOG_WINDOW_SCROLL_THRESHOLD, clientHeight, scrollHeight }),
      true,
    );
    assert.equal(
      shouldLoadMore({ scrollTop: bottom - CATALOG_WINDOW_SCROLL_THRESHOLD - 1, clientHeight, scrollHeight }),
      false,
    );
  });

  it("keeps the default threshold smaller than the shortest catalog viewport", () => {
    // A band taller than the viewport is armed at scrollTop 0, which makes the
    // window grow before the player has scrolled at all.
    assert.equal(CATALOG_WINDOW_SCROLL_THRESHOLD < BUILDING_LENS_MIN_CATALOG_HEIGHT, true);
  });
});

describe("growing the window", () => {
  it("grows by one step until the ceiling", () => {
    assert.equal(nextWindowLimit(100, 100, 3677), 200);
    assert.equal(nextWindowLimit(3600, 100, 3677), 3677);
  });

  it("never returns more than the ceiling once it is reached", () => {
    assert.equal(nextWindowLimit(3677, 100, 3677), 3677);
    assert.equal(nextWindowLimit(9000, 100, 3677), 3677);
  });

  it("collapses to nothing when the match set is empty", () => {
    assert.equal(nextWindowLimit(100, 100, 0), 0);
  });

  it("does not grow on a step that cannot make progress", () => {
    // A zero step would hand the caller back the same limit it already has,
    // and a negative one would shrink the window under the player's scroll.
    assert.equal(nextWindowLimit(100, 0, 3677), 100);
    assert.equal(nextWindowLimit(100, -50, 3677), 100);
    assert.equal(nextWindowLimit(100, Number.NaN, 3677), 100);
  });

  it("holds the current limit when the ceiling is unknown", () => {
    // Not knowing how much exists is not a licence to ask for more of it.
    assert.equal(nextWindowLimit(100, 100, Number.NaN), 100);
  });

  it("starts from the base step when the current limit is nonsense", () => {
    assert.equal(nextWindowLimit(Number.NaN, 100, 3677), 100);
    assert.equal(nextWindowLimit(-20, 100, 3677), 100);
  });

  it("returns whole rows", () => {
    assert.equal(nextWindowLimit(100.5, 100.5, 3677), 200);
  });
});

describe("returning to a remembered row", () => {
  it("puts the anchor a third of the way down rather than flush to the top", async () => {
    const { anchorScrollTop } = await import("../src/domain/catalogWindow.ts");

    // Container top 100, height 300, anchor currently at 700 on screen.
    // delta = 700 - 100 - 100 = 500.
    assert.equal(anchorScrollTop(0, 700, 100, 300), 500);
    assert.equal(anchorScrollTop(200, 700, 100, 300), 700);
  });

  it("never asks to scroll above the start of the list", async () => {
    const { anchorScrollTop } = await import("../src/domain/catalogWindow.ts");

    // A row near the top of a short list produces a negative delta.
    assert.equal(anchorScrollTop(0, 110, 100, 300), 0);
  });

  it("leaves the scroll alone when the geometry is not measurable yet", async () => {
    const { anchorScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(anchorScrollTop(42, Number.NaN, 100, 300), 42);
    assert.equal(anchorScrollTop(42, 700, 100, Number.POSITIVE_INFINITY), 42);
  });
});
