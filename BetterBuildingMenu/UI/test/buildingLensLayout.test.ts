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
  // Measured live at 1280x720 with PanelWidth 1441 (the whole assembly,
  // control pane included) on 2026-09-09, with every column set to its
  // comfortable width by hand: the row is 1026rem, the seven cells drew at
  // exactly their 586rem, nothing overflowed, and the name still had 327rem.
  // An earlier reading of the same row as 820rem was wrong, and the 422rem
  // "room" derived from it held the columns to 72 % of what fits.
  it("gives every column its comfortable width at the default assembly", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_MAX_WIDTH, BUILDING_LENS_PANEL_CHROME_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    assert.deepEqual(getBuildingLensColumnWidths(BUILDING_LENS_MAX_WIDTH + BUILDING_LENS_PANEL_CHROME_WIDTH), BUILDING_LENS_COLUMN_MAX);
  });

  it("never goes below the minimum table, however narrow the panel", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MIN, BUILDING_LENS_MIN_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

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

  it("moves monotonically between the two ends, in every column", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_MIN_WIDTH, BUILDING_LENS_MAX_WIDTH } = await import(
      "../src/domain/buildingLensLayout.ts"
    );

    let previous = getBuildingLensColumnWidths(BUILDING_LENS_MIN_WIDTH);

    for (let w = BUILDING_LENS_MIN_WIDTH; w <= BUILDING_LENS_MAX_WIDTH; w += 25) {
      const widths = getBuildingLensColumnWidths(w);
      for (const key of Object.keys(widths) as (keyof typeof widths)[]) {
        assert.ok(widths[key] >= previous[key], `${key} fell from ${previous[key]} to ${widths[key]} at ${w}`);
      }
      previous = widths;
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
    for (const width of Object.values(getBuildingLensColumnWidths(1400))) {
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
    // draws — and it clipped its last character on every road in the table.
    const { BUILDING_LENS_COLUMN_MIN, BUILDING_LENS_COLUMN_MAX } = await import("../src/domain/buildingLensLayout.ts");

    // The figure does not scale with the panel, so both bounds must hold it:
    // at 1280x720 a rem draws 0.54px and the text wants 59–60px — 112rem.
    // The first attempt raised only the minimum, and the cell — already at its
    // maximum of 108rem on that panel — still clipped.
    assert.ok(BUILDING_LENS_COLUMN_MIN.upkeep >= 112, `upkeep min is ${BUILDING_LENS_COLUMN_MIN.upkeep}rem`);
    assert.ok(BUILDING_LENS_COLUMN_MAX.upkeep >= 112, `upkeep max is ${BUILDING_LENS_COLUMN_MAX.upkeep}rem`);
  });
});

describe("the row's furniture", () => {
  it("mirrors the stylesheet's trailing reserve, gap before the chevron included", async () => {
    // $table-trailing-reserve = 4 + 26 + 4 + 3 = 37; then the rows' scrollbar
    // (16), .rowSelect's left padding (8) and the thumbnail with its margin
    // (80). Measured 2026-09-09: 33rem trail a 1026rem select inside a
    // 1059rem rows box, and the name got 327rem where this budget said 332.
    const { BUILDING_LENS_TABLE_ROW_FURNITURE } = await import("../src/domain/buildingLensLayout.ts");
    assert.equal(BUILDING_LENS_TABLE_ROW_FURNITURE, 37 + 16 + 8 + 80);
  });
});

describe("the metric columns fit the room beside the name", () => {
  // The room is what the row really has: assembly − control pane − the
  // panel's chrome around the rows − the row's own furniture − the name's
  // basis. Measured at PanelWidth 1441: the panel is 1441 − 385 = 1056rem and
  // the row 1026rem, so the chrome is 30; less 141 furniture and the 260 the
  // name keeps, 625rem — which is why the 586rem maximum fits there.
  it("is the measured row less the furniture and the name's basis at the default assembly", async () => {
    const { tableColumnRoom, BUILDING_LENS_MAX_WIDTH, BUILDING_LENS_PANEL_CHROME_WIDTH, BUILDING_LENS_TABLE_ROW_FURNITURE } = await import("../src/domain/buildingLensLayout.ts");

    assert.equal(tableColumnRoom(BUILDING_LENS_MAX_WIDTH + BUILDING_LENS_PANEL_CHROME_WIDTH), 1026 - BUILDING_LENS_TABLE_ROW_FURNITURE - 260);
  });

  it("holds the set to the room where the preference would overrun it", async () => {
    // A 1350rem assembly has about 500rem beside a 260rem name; the columns
    // take exactly that, not the 586 they would prefer, so the name keeps its
    // basis instead of being the one flex item that yields.
    const { getBuildingLensColumnWidths, tableColumnRoom } = await import("../src/domain/buildingLensLayout.ts");
    const room = tableColumnRoom(1350);
    const total = Object.values(getBuildingLensColumnWidths(1350)).reduce((a, b) => a + b, 0);

    assert.ok(room > 478 && room < 586, `room ${room}rem sits between the minimum and comfortable sets`);
    assert.ok(Math.abs(total - room) <= 3, `columns sum to ${total}rem of ${room}`);
  });

  it("keeps every column's share of the room in proportion to its preference", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX } = await import("../src/domain/buildingLensLayout.ts");
    const widths = getBuildingLensColumnWidths(1350);

    assert.ok(widths.upkeep > widths.cost && widths.capacity > widths.cost, "upkeep and capacity stay the widest");
    assert.ok(widths.upkeep / widths.level > BUILDING_LENS_COLUMN_MAX.upkeep / BUILDING_LENS_COLUMN_MAX.level * 0.9);
  });

  it("shrinks the room as the text scale grows the figures", async () => {
    // At 125 % the cells' figures are wider by the same ratio as the font,
    // so the set that fits is the room over that ratio: still at most the
    // room, and still whole units.
    const { getBuildingLensColumnWidths, tableColumnRoom, BUILDING_LENS_MAX_WIDTH, BUILDING_LENS_PANEL_CHROME_WIDTH } = await import("../src/domain/buildingLensLayout.ts");
    const outer = BUILDING_LENS_MAX_WIDTH + BUILDING_LENS_PANEL_CHROME_WIDTH;
    const total = Object.values(getBuildingLensColumnWidths(outer, 1.25)).reduce((a, b) => a + b, 0);

    assert.ok(total <= tableColumnRoom(outer) + 3, `columns sum to ${total}rem of ${tableColumnRoom(outer)}`);
    assert.ok(total > tableColumnRoom(outer) - 8, `columns leave ${tableColumnRoom(outer) - total}rem unused`);
  });

  it("does not cap where there is room to spare", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX } = await import("../src/domain/buildingLensLayout.ts");
    assert.deepEqual(getBuildingLensColumnWidths(3000), BUILDING_LENS_COLUMN_MAX);
  });
});
