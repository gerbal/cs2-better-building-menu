import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_WINDOW_SCROLL_THRESHOLD,
  nextWindowLimit,
  shouldLoadMore,
  catalogWindowRemaining,
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

  it("says no until the player has actually scrolled", () => {
    // Cohtml fills a scroll container over several frames — the same list was
    // measured at scrollHeight 1,440 and then 3,606 a frame or two later — so a
    // window still being laid out reports a short content height that sits
    // inside the band while nobody has touched anything. Measured live
    // 2026-08-09: without this rule the unscoped lens grew itself from 100 rows
    // to 200 on mount, at scrollTop 0.
    assert.equal(
      shouldLoadMore({ scrollTop: 0, clientHeight: 468, scrollHeight: 700, threshold: 280 }),
      false,
    );
    // The same three numbers with any evidence of a scroll is the real case.
    assert.equal(
      shouldLoadMore({ scrollTop: 1, clientHeight: 468, scrollHeight: 700, threshold: 280 }),
      true,
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

describe("telling a real measurement from Cohtml's pre-layout zeroes", () => {
  it("rejects the all-zero rects the engine reports on the remount frame", async () => {
    const { isAnchorMeasurable } = await import("../src/domain/catalogWindow.ts");

    // Measured live 2026-08-09: the frame the catalog remounts, the container
    // and every row inside it report top 0 and height 0, and the panel's real
    // top is 163. Believing that frame scrolls the list to 0 and calls it a
    // restore.
    assert.equal(
      isAnchorMeasurable({ containerTop: 0, containerHeight: 0, rowTop: 0, rowHeight: 0 }),
      false,
    );
  });

  it("accepts a container legitimately laid out at the top of the viewport", async () => {
    const { isAnchorMeasurable } = await import("../src/domain/catalogWindow.ts");

    // top === 0 is not the tell; a zero height is.
    assert.equal(
      isAnchorMeasurable({ containerTop: 0, containerHeight: 468, rowTop: 0, rowHeight: 75 }),
      true,
    );
  });

  it("rejects a row that has not been laid out inside a container that has", async () => {
    const { isAnchorMeasurable } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      isAnchorMeasurable({ containerTop: 163, containerHeight: 468, rowTop: 0, rowHeight: 0 }),
      false,
    );
  });
});

describe("checking the anchor actually landed", () => {
  it("counts any overlap with the viewport as landed", async () => {
    const { isAnchorOnScreen } = await import("../src/domain/catalogWindow.ts");

    // Fully inside.
    assert.equal(
      isAnchorOnScreen({ containerTop: 163, containerHeight: 468, rowTop: 300, rowHeight: 75 }),
      true,
    );
    // Straddling the top edge, and the bottom edge. Asking for the exact
    // third-of-the-way position back would restart the loop over a few pixels
    // of drift while rows are still arriving.
    assert.equal(
      isAnchorOnScreen({ containerTop: 163, containerHeight: 468, rowTop: 120, rowHeight: 75 }),
      true,
    );
    assert.equal(
      isAnchorOnScreen({ containerTop: 163, containerHeight: 468, rowTop: 600, rowHeight: 75 }),
      true,
    );
  });

  it("does not count a row above or below the viewport", async () => {
    const { isAnchorOnScreen } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      isAnchorOnScreen({ containerTop: 163, containerHeight: 468, rowTop: 40, rowHeight: 75 }),
      false,
    );
    // The case that started this: the row is present, 2,174 down a panel whose
    // viewport ends at 631, and the list is sitting at scrollTop 0.
    assert.equal(
      isAnchorOnScreen({ containerTop: 163, containerHeight: 468, rowTop: 2174, rowHeight: 75 }),
      false,
    );
  });

  it("never reports landed on geometry it cannot trust", async () => {
    const { isAnchorOnScreen } = await import("../src/domain/catalogWindow.ts");

    // Zero height overlaps nothing, but the arithmetic alone would say the row
    // at 0 is inside a viewport at 0 — which is exactly the pre-layout frame.
    assert.equal(
      isAnchorOnScreen({ containerTop: 0, containerHeight: 0, rowTop: 0, rowHeight: 0 }),
      false,
    );
  });

  it("gives the restore a bounded budget of frames", async () => {
    const { CATALOG_ANCHOR_MAX_FRAMES } = await import("../src/domain/catalogWindow.ts");

    // Half a second at 60Hz: long enough for the window to arrive from C# and
    // lay out, short enough that an unreachable anchor gives up before the
    // player has scrolled somewhere themselves.
    assert.equal(CATALOG_ANCHOR_MAX_FRAMES, 30);
  });
});

describe("finding the element that actually scrolls", () => {
  it("ignores a container that sub-pixel rounding pushed one pixel over", async () => {
    const { isScrollContainer } = await import("../src/domain/catalogWindow.ts");

    // Measured live 2026-08-09: the grid's inner tiles container reported
    // scrollHeight 382 against clientHeight 381. A walk that believed it read
    // scrollTop 0 forever, and the window never grew however far the player
    // scrolled the real container above it.
    assert.equal(isScrollContainer(382, 381), false);
  });

  it("accepts a container with a real list inside it", async () => {
    const { isScrollContainer } = await import("../src/domain/catalogWindow.ts");

    assert.equal(isScrollContainer(796, 468), true);
  });

  it("takes the threshold as the boundary, not as a suggestion", async () => {
    const { isScrollContainer, CATALOG_SCROLL_MIN_OVERFLOW } = await import("../src/domain/catalogWindow.ts");

    assert.equal(isScrollContainer(468 + CATALOG_SCROLL_MIN_OVERFLOW, 468), true);
    assert.equal(isScrollContainer(468 + CATALOG_SCROLL_MIN_OVERFLOW - 1, 468), false);
  });

  it("says no rather than guessing on a measurement that is not a number", async () => {
    const { isScrollContainer } = await import("../src/domain/catalogWindow.ts");

    assert.equal(isScrollContainer(Number.NaN, 468), false);
    assert.equal(isScrollContainer(796, Number.NaN), false);
  });
});

describe("What the window is holding back", () => {
  it("reports the rows the window has not served", () => {
    // Landscaping, measured: 368 match, 100 are served.
    assert.equal(catalogWindowRemaining({ shown: 100, total: 368 }), 268);
  });

  it("says nothing rather than zero once everything is on screen", () => {
    // Null so the caller draws no footer at all. "Load 0 more" is a control
    // that cannot act, and the footer's whole job is to say the list is
    // truncated — which it is not.
    assert.equal(catalogWindowRemaining({ shown: 368, total: 368 }), null);
    assert.equal(catalogWindowRemaining({ shown: 0, total: 0 }), null);
  });

  it("does not go negative when the backend has served more than it counted", () => {
    // The page and the total are published separately, so a refresh can land
    // between them. A negative "Load -3 more" is worse than no offer.
    assert.equal(catalogWindowRemaining({ shown: 12, total: 9 }), null);
  });
});

describe("revealing a row that grew past the fold", () => {
  it("does nothing when the whole thing already fits", async () => {
    const { revealScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      revealScrollTop({
        currentScrollTop: 120,
        rowTop: 400,
        detailBottom: 600,
        containerTop: 353,
        containerHeight: 277,
      }),
      120,
    );
  });

  it("scrolls by the overflow and no further", async () => {
    // Measured live: expanding a row put its detail's bottom at 642 against a
    // viewport whose content ends at containerTop + clientHeight = 630, and
    // nothing moved. Twelve pixels of a metrics line sat under the fold with no
    // cue that they were there. (The scroller's bounding rect reads 631 — the
    // extra pixel is its border, which content does not get to use.)
    //
    // By the overflow only, because this fires on every expand — anchoring the
    // row a third of the way down the container, the way a restore does, would
    // throw the list around every time a player opened a detail.
    const { revealScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      revealScrollTop({
        currentScrollTop: 0,
        rowTop: 519,
        detailBottom: 642,
        containerTop: 353,
        containerHeight: 277,
      }),
      12,
    );
  });

  it("keeps a margin below so the last line is not flush with the edge", async () => {
    const { revealScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      revealScrollTop({
        currentScrollTop: 0,
        rowTop: 519,
        detailBottom: 642,
        containerTop: 353,
        containerHeight: 277,
        margin: 6,
      }),
      18,
    );
  });

  it("never scrolls the row's own top out of view", async () => {
    // A detail taller than the viewport cannot be shown whole. Showing its
    // BOTTOM would push the row's name off the top, leaving the player looking
    // at numbers with nothing to say what they belong to.
    const { revealScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      revealScrollTop({
        currentScrollTop: 0,
        rowTop: 400,
        detailBottom: 1200,
        containerTop: 353,
        containerHeight: 277,
      }),
      47,
    );
  });

  it("never scrolls upward", async () => {
    const { revealScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      revealScrollTop({
        currentScrollTop: 90,
        rowTop: 360,
        detailBottom: 400,
        containerTop: 353,
        containerHeight: 277,
      }),
      90,
    );
  });

  it("returns the current position rather than NaN on a pre-layout measurement", async () => {
    // Cohtml reports zeroes for a frame after a relayout; a NaN assigned to
    // scrollTop would send the list to the top.
    const { revealScrollTop } = await import("../src/domain/catalogWindow.ts");

    assert.equal(
      revealScrollTop({
        currentScrollTop: 42,
        rowTop: Number.NaN,
        detailBottom: 600,
        containerTop: 353,
        containerHeight: 277,
      }),
      42,
    );
  });
});
