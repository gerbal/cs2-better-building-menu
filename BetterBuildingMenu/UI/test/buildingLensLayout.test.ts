import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDING_LENS_TITLE_ICON,
  BUILDING_LENS_TITLE_GAP,
  getBuildingLensRowGeometry,
  BUILDING_LENS_MAX_WIDTH,
  BUILDING_LENS_MIN_WIDTH,
  getBuildingLensDensity,
  getBuildingLensMetricLabel,
  getBuildingLensMetricTextScale,
  getBuildingLensCatalogMaxHeight,
  clampBuildingLensHeight,
  draggedBuildingLensHeight,
  BUILDING_LENS_MIN_HEIGHT,
  BUILDING_LENS_MAX_HEIGHT,
  BUILDING_LENS_DEFAULT_HEIGHT,
} from "../src/domain/buildingLensLayout.ts";

describe("Building Lens panel geometry", () => {
  it("maps exact outer-width boundaries to density tiers", () => {
    assert.equal(getBuildingLensDensity(735), "compact");
    assert.equal(getBuildingLensDensity(799), "compact");
    assert.equal(getBuildingLensDensity(800), "default");
    assert.equal(getBuildingLensDensity(999), "default");
    assert.equal(getBuildingLensDensity(1000), "expanded");
    assert.equal(getBuildingLensDensity(1235), "expanded");
  });

  it("abbreviates metric headers only in compact density", () => {
    assert.equal(getBuildingLensMetricLabel("upkeep", "compact", "Upkeep"), "Upk");
    assert.equal(getBuildingLensMetricLabel("workers", "compact", "Workers"), "Wkr");
    assert.equal(getBuildingLensMetricLabel("upkeep", "default", "Unterhalt"), "Unterhalt");
    assert.equal(getBuildingLensMetricLabel("upkeep", "expanded", "Unterhalt"), "Unterhalt");
  });

  it("uses a readable metric text scale outside compact density", () => {
    assert.equal(getBuildingLensMetricTextScale("compact"), "compact");
    assert.equal(getBuildingLensMetricTextScale("default"), "readable");
    assert.equal(getBuildingLensMetricTextScale("expanded"), "readable");
  });

  it("keeps the default and compact row geometry dense but readable", () => {
    assert.deepEqual(getBuildingLensRowGeometry("default"), {
      rowHeight: 92,
      selectorHeight: 88,
      identityHeight: 72,
      selectorVerticalPadding: 2,
    });
    assert.deepEqual(getBuildingLensRowGeometry("compact"), {
      rowHeight: 84,
      selectorHeight: 80,
      identityHeight: 72,
      selectorVerticalPadding: 2,
    });
  });

  it("uses the building signature as the title icon", () => {
    assert.equal(BUILDING_LENS_TITLE_ICON, "coui://betterbuildingmenu/Icons/Colored/BuildingZoneSignature.svg");
    assert.equal(BUILDING_LENS_TITLE_GAP, 6);
  });

  it("budgets the catalog below the shell chrome at the 1280x720 render target", () => {
    assert.equal(getBuildingLensCatalogMaxHeight(720), 765);
    assert.equal(getBuildingLensCatalogMaxHeight(1080), 870);
    assert.equal(getBuildingLensCatalogMaxHeight(Number.NaN), 765);
  });
});

describe("Building Lens catalog height", () => {
  it("holds the drag inside the range", () => {
    assert.equal(clampBuildingLensHeight(BUILDING_LENS_MIN_HEIGHT - 50), BUILDING_LENS_MIN_HEIGHT);
    assert.equal(clampBuildingLensHeight(BUILDING_LENS_MAX_HEIGHT + 50), BUILDING_LENS_MAX_HEIGHT);
    assert.equal(clampBuildingLensHeight(500), 500);
  });

  it("falls back to the default rather than passing a non-finite height through", () => {
    // It goes straight into an inline style: height: NaNrem leaves the catalog
    // unsized rather than merely the wrong size.
    assert.equal(clampBuildingLensHeight(Number.NaN), BUILDING_LENS_DEFAULT_HEIGHT);
    assert.equal(clampBuildingLensHeight(Number.POSITIVE_INFINITY), BUILDING_LENS_DEFAULT_HEIGHT);
  });

  it("grows when the top edge is dragged upward", () => {
    // The panel is bottom-anchored and the handle is on its top edge, so a
    // smaller clientY means a taller panel. Getting this sign wrong gives a
    // handle that shrinks the panel when you pull it open.
    const taller = draggedBuildingLensHeight(400, 500, 400);
    const shorter = draggedBuildingLensHeight(400, 500, 600);

    assert.ok(taller > 400);
    assert.ok(shorter < 400);
  });

  it("treats a non-finite pointer as no movement", () => {
    assert.equal(draggedBuildingLensHeight(400, Number.NaN, 300), 400);
  });
});

describe("Table column widths", () => {
  it("gives every column its comfortable width on the widest panel", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_MAX_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    assert.deepEqual(getBuildingLensColumnWidths(BUILDING_LENS_MAX_WIDTH), BUILDING_LENS_COLUMN_MAX);
  });

  it("squeezes them to their floor on the narrowest panel", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MIN, BUILDING_LENS_MIN_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    // The whole point: those units go to the name. Measured live at the minimum
    // panel width, the identity cell was 39px and the name inside it was ZERO
    // while Capacity held its full width to render "—".
    assert.deepEqual(getBuildingLensColumnWidths(BUILDING_LENS_MIN_WIDTH), BUILDING_LENS_COLUMN_MIN);
  });

  it("hands the name a real share of a narrow panel", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_MIN_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
    const reclaimed = sum(BUILDING_LENS_COLUMN_MAX) - sum(getBuildingLensColumnWidths(BUILDING_LENS_MIN_WIDTH));

    // Enough to matter: a name column of 111px was rendering "EU Commercial
    // Gas S…" for three different buildings.
    assert.equal(reclaimed >= 100, true);
  });

  it("moves monotonically between the two ends", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_MIN_WIDTH, BUILDING_LENS_MAX_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    let previous = getBuildingLensColumnWidths(BUILDING_LENS_MIN_WIDTH).capacity;

    for (let w = BUILDING_LENS_MIN_WIDTH; w <= BUILDING_LENS_MAX_WIDTH; w += 25) {
      const capacity = getBuildingLensColumnWidths(w).capacity;
      assert.equal(capacity >= previous, true);
      previous = capacity;
    }
  });

  it("clamps a panel width outside the supported range", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_COLUMN_MIN } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    assert.deepEqual(getBuildingLensColumnWidths(50), BUILDING_LENS_COLUMN_MIN);
    assert.deepEqual(getBuildingLensColumnWidths(99999), BUILDING_LENS_COLUMN_MAX);
  });

  it("returns whole units so the header cannot land off the rows", async () => {
    const { getBuildingLensColumnWidths } = await import("../src/domain/buildingLensLayout.ts");

    // The table has already been fixed once for a header that drifted from its
    // rows; a fractional width would reintroduce it a pixel at a time.
    for (const width of Object.values(getBuildingLensColumnWidths(900))) {
      assert.equal(Number.isInteger(width), true);
    }
  });

  it("says something rather than nothing for a nonsense width", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MIN } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    assert.deepEqual(getBuildingLensColumnWidths(Number.NaN), BUILDING_LENS_COLUMN_MIN);
  });
});

describe("the Upkeep column at the narrowest panel", () => {
  it("holds a per-kilometre figure without clipping", async () => {
    // A road's upkeep is "¢2,437 /km/mo." — the widest figure the column ever
    // draws. Measured live at 1280x720 with the panel at its minimum: the text
    // wants 59–60px of a 57px cell (80rem), and clipped its last character on
    // every road in the table. 84rem is 60px.
    const { BUILDING_LENS_COLUMN_MIN } = await import("../src/domain/buildingLensLayout.ts");

    assert.ok(BUILDING_LENS_COLUMN_MIN.upkeep >= 84, `upkeep min is ${BUILDING_LENS_COLUMN_MIN.upkeep}rem`);
  });
});
