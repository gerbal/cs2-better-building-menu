import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_WINDOW_SCROLL_THRESHOLD,
  keptRows,
  nextWindowLimit,
  shouldLoadMore,
  catalogWindowRemaining,
  isOnLineOne,
  lineOneScrollTop,
  pageScrollTop,
  revealScrollTop,
} from "../src/domain/catalogWindow.ts";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog.ts";
import { bodyGrid, bodyLines } from "../src/domain/bodyGeometry.ts";

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
    // Cohtml fills a scroll container over several frames, so a window still
    // being laid out reports a short content height that sits inside the band
    // while nobody has touched anything — and the asset menu grows itself on mount.
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

    // On the frame the catalog remounts, the container and every row inside it
    // report top 0 and height 0. Believing that frame scrolls the list to the
    // top and calls it a restore.
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
    // The row is present, far down a list whose viewport ends well above it,
    // and the list is sitting at scrollTop 0.
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

    // The grid's inner tiles container can report a scrollHeight barely over
    // its clientHeight. A walk that believes it reads scrollTop 0 forever, and
    // the window never grows however far the real container above it scrolls.
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
    // 368 match, 100 are served.
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

describe("putting a row on the list's first line", () => {
  it("scrolls by the row's distance from the top of the list's viewport", () => {
    // The row is 350 px down a viewport that starts at 50, with the list already 100 in.
    assert.equal(lineOneScrollTop(100, 350, 50, 0), 400);
  });

  it("never asks to scroll above the start of the list", () => {
    assert.equal(lineOneScrollTop(10, 20, 50, 0), 0);
  });

  it("counts a row within a pixel of the first line as on it, and no further", () => {
    // Cohtml rounds line boxes to whole device pixels.
    assert.equal(isOnLineOne({ containerTop: 50, containerHeight: 100, rowTop: 51, rowHeight: 20 }, 0), true);
    assert.equal(isOnLineOne({ containerTop: 50, containerHeight: 100, rowTop: 52, rowHeight: 20 }, 0), false);
    assert.equal(lineOneScrollTop(Number.NaN, 350, 50, 0), Number.NaN);
    assert.equal(lineOneScrollTop(100, Number.NaN, 50, 0), 100);
  });

  it("puts a one-line plate's row its picture's overhang below the top, so the picture's top draws whole", () => {
    // Two pixels a rem: the picture overhangs its plate by 2 px above it.
    assert.equal(lineOneScrollTop(100, 350, 50, 2), 398);
    assert.equal(isOnLineOne({ containerTop: 50, containerHeight: 100, rowTop: 52, rowHeight: 44 }, 2), true);
    assert.equal(isOnLineOne({ containerTop: 50, containerHeight: 100, rowTop: 50, rowHeight: 44 }, 2), false);
    // The first row is on line 1 at the list's top.
    assert.equal(lineOneScrollTop(0, 52, 50, 2), 0);
  });

  it("never counts a one-line plate as on line 1 with its picture above the top, whatever the pixel's rounding", () => {
    const at = (rowTop: number, edge: number) => isOnLineOne({ containerTop: 50, containerHeight: 100, rowTop, rowHeight: 22 }, edge);

    // 1080p: the overhang is a pixel, as much as the rounding the line forgives below it.
    assert.deepEqual([at(50, 1), at(51, 1), at(52, 1)], [false, true, true]);
    // 720p: two thirds of a pixel.
    assert.deepEqual([at(50, 2 / 3), at(50 + 2 / 3, 2 / 3), at(51 + 2 / 3, 2 / 3)], [false, true, true]);
    // With no overhang a line forgives a pixel either way.
    assert.deepEqual([at(49, 0), at(51, 0)], [true, true]);
  });
});

describe("a page of the list", () => {
  it("is a screen down or up, held inside the list's ends", () => {
    // A 100-tall viewport over 1,000 of list: the scroll runs 0-900.
    assert.equal(pageScrollTop(200, 100, 1000, 1, 0, 0, 0, 0), 300);
    assert.equal(pageScrollTop(300, 100, 1000, -1, 0, 0, 0, 0), 200);
    assert.equal(pageScrollTop(850, 100, 1000, 1, 0, 0, 0, 0), 900);
    assert.equal(pageScrollTop(50, 100, 1000, -1, 0, 0, 0, 0), 0);
    // A list that fits has nowhere to go.
    assert.equal(pageScrollTop(0, 100, 80, 1, 0, 0, 0, 0), 0);
  });
});

describe("a page of a body's lines", () => {
  it("is the whole lines that fit the screen, so lines land on the top edge as they were", () => {
    // 29.25-pixel lines in a 100-pixel screen: three whole lines a page.
    assert.equal(pageScrollTop(0, 100, 1000, 1, 29.25, 2, 0, 0), 87.75);
    assert.equal(pageScrollTop(87.75, 100, 1000, -1, 29.25, 2, 0, 0), 0);
  });

  it("is at least one line, however short the screen", () => {
    assert.equal(pageScrollTop(0, 20, 1000, 1, 29.25, 2, 0, 0), 29.25);
  });

  it("counts the lines as the body does, the last needing no gap below it", () => {
    // The game's own body, 144.25 tall, holds five 27.25 plates 2 apart: a page is all five.
    assert.equal(pageScrollTop(0, 144.25, 1000, 1, 29.25, 2, 0, 0), 146.25);
  });

  it("keeps inside the list's ends", () => {
    assert.equal(pageScrollTop(880, 100, 1000, 1, 29.25, 2, 0, 0), 900);
  });

  it("takes the gap and the edge with the pitch, so no caller can page a line short or a line long", () => {
    // Eight parameters and no default: a pitch without its gap counts 4.93 lines as 4, and does not compile.
    assert.equal(pageScrollTop.length, 8);
    // @ts-expect-error The gap, the pixel and the edge are required.
    const withoutGap = () => pageScrollTop(0, 144.25, 1000, 1, 29.25);
    // @ts-expect-error The edge is required.
    const withoutEdge = () => pageScrollTop(0, 144.25, 1000, 1, 29.25, 2, 1);
    assert.equal(typeof withoutGap, "function");
    assert.equal(typeof withoutEdge, "function");
  });

  it("pages a one-line plate's lines inside the room their pictures overhang into, at both ends", () => {
    // At 1080p a rem is a pixel. Six lines and a rem above and below take 144 of a 166-pixel screen; a
    // seventh needs 168, 167 with the pixel forgiven. Counted without the room, the page would step seven.
    assert.equal(pageScrollTop(0, 166, 10000, 1, 24, 2, 1, 1), 6 * 24);
    assert.equal(pageScrollTop(0, 166, 10000, 1, 24, 2, 1, 0), 7 * 24);
  });

  it("pages as many of a one-line plate's lines as the body draws, at every height", () => {
    // At 1080p a rem is a pixel, and the scroller reads its height in whole pixels.
    for (let bodyHeight = 100; bodyHeight <= 900; bodyHeight += 0.25) {
      const grid = bodyGrid({ body: "list", boxWidth: 706, bodyHeight, pixelRem: 1, textScale: 1.3, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0 });
      const lines = bodyLines(grid, null);

      assert.equal(pageScrollTop(0, Math.floor(bodyHeight), 100000, 1, lines.pitch, lines.gap, 1, lines.edge), grid.lines * grid.pitchY, `${bodyHeight}`);
    }
  });

  it("pages five lines of a scroller that reads whole pixels: 96 px at 720p is 144 rem, a rem short of five lines", () => {
    // At 720p a rem is 2/3 px: the pitch 29.25 rem is 19.5 px and the gap 2 rem 4/3 px. Five lines need 96.17 px.
    assert.equal(pageScrollTop(0, 96, 10000, 1, 19.5, 4 / 3, 1, 0), 5 * 19.5);
    assert.equal(pageScrollTop(0, 94, 10000, 1, 19.5, 4 / 3, 1, 0), 4 * 19.5);
  });
});

describe("bringing Enter's target on screen", () => {
  it("leaves a row already wholly on screen where it is", () => {
    assert.equal(revealScrollTop(300, 150, 27, 100, 144, 0), 300);
  });

  it("scrolls up to a row above the screen, and down until a row below meets the foot", () => {
    assert.equal(revealScrollTop(300, 60, 27, 100, 144, 0), 260);
    assert.equal(revealScrollTop(300, 230, 27, 100, 144, 0), 313);
  });

  it("brings a one-line plate's picture whole on screen, its overhang above and below its plate", () => {
    // 22-tall plates whose pictures overhang them by 1.
    assert.equal(revealScrollTop(300, 101, 22, 100, 144, 1), 300);
    assert.equal(revealScrollTop(300, 60, 22, 100, 144, 1), 259);
    assert.equal(revealScrollTop(300, 230, 22, 100, 144, 1), 309);
  });

  it("never asks for a scroll above the top, and keeps its place on a reading it cannot use", () => {
    assert.equal(revealScrollTop(10, 40, 27, 100, 144, 0), 0);
    assert.equal(revealScrollTop(300, Number.NaN, 27, 100, 144, 0), 300);
  });
});

describe("a page's rows, kept from the last page", () => {
  const row = (id: number, over: Record<string, unknown> = {}) =>
    ({ id, name: `Plaza ${id}`, constructionCost: 1_000, assetPacks: ["Pack"], serviceFacts: [{ key: "range", value: 3 }], ...over }) as unknown as BuildingCatalogEntry;
  // Each page arrives as new objects, as the binding's JSON does.
  const fresh = (rows: BuildingCatalogEntry[]) => JSON.parse(JSON.stringify(rows)) as BuildingCatalogEntry[];

  it("keeps the last page's object for a row that says the same, and takes the new one for a row that moved", () => {
    const first = keptRows(fresh([row(1), row(2), row(3)]));
    const next = keptRows(fresh([row(1), row(2, { constructionCost: 2_000 }), row(3, { serviceFacts: [{ key: "range", value: 4 }] }), row(4)]));

    assert.equal(next[0], first[0]);
    assert.notEqual(next[1], first[1]);
    assert.equal(next[1].constructionCost, 2_000);
    assert.notEqual(next[2], first[2]);
    assert.equal(next.length, 4);
  });

  it("forgets a row the last page did not carry", () => {
    const first = keptRows(fresh([row(1)]));
    keptRows(fresh([row(2)]));

    assert.notEqual(keptRows(fresh([row(1)]))[0], first[0]);
  });

  it("tells a field gone from one that is there, and an array from an object", () => {
    const first = keptRows(fresh([row(1, { theme: "EU" })]));

    assert.notEqual(keptRows(fresh([row(1)]))[0], first[0]);
    const listed = keptRows(fresh([row(2)]))[0];
    assert.notEqual(keptRows(fresh([row(2, { assetPacks: { 0: "Pack" } })]))[0], listed);
  });
});
