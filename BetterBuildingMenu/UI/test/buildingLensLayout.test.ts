import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, rem, sides } from "./harness/compiledCss.ts";
import {
  getBuildingLensRowGeometry,
  getBuildingLensDensity,
  getBuildingLensMetricLabel,
  getBuildingLensMetricTextScale,
  getBuildingLensCatalogMaxHeight,
  clampBuildingLensHeight,
  draggedBuildingLensHeight,
  BUILDING_LENS_MIN_HEIGHT,
  BUILDING_LENS_MAX_HEIGHT,
  BUILDING_LENS_DEFAULT_HEIGHT,
  BUILDING_LENS_CONTROL_PANE_TOTAL,
  BUILDING_LENS_PANEL_CHROME_WIDTH,
  BUILDING_LENS_TABLE_ROW_FURNITURE,
  LENS_RESIZE_HANDLE_HEIGHT,
} from "../src/domain/buildingLensLayout.ts";
import { BUILDING_LENS_MAX_WIDTH } from "../src/domain/sharedContracts.generated.ts";


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

  it("keeps the edge under the cursor at any scale", () => {
    // 60px up is 60rem at 1080p (1px per rem) and 90rem at 720p (2/3px per
    // rem). A fixed ratio would run the panel 1.5x ahead of the cursor at 1080p.
    assert.equal(draggedBuildingLensHeight(400, 500, 440, 1), 460);
    assert.equal(draggedBuildingLensHeight(400, 500, 440, 2 / 3), 490);
    assert.equal(draggedBuildingLensHeight(400, 500, 440, 2), 430);
  });

  it("measures rem off the drawn resize strip", async () => {
    const { pxPerRemFrom, LENS_RESIZE_HANDLE_HEIGHT } = await import("../src/domain/buildingLensLayout.ts");
    // 14rem drawn 14px tall at 1080p, 21px at 1440p.
    assert.equal(pxPerRemFrom(14, LENS_RESIZE_HANDLE_HEIGHT), 1);
    assert.equal(pxPerRemFrom(21, LENS_RESIZE_HANDLE_HEIGHT), 1.5);
    // Cohtml's pre-layout zero, or no rect at all, is no measurement.
    for (const bad of [0, -3, Number.NaN, null, undefined]) {
      assert.equal(pxPerRemFrom(bad, LENS_RESIZE_HANDLE_HEIGHT), undefined);
    }
  });

  it("falls back to the 720p ratio when the measurement is unusable", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      assert.equal(draggedBuildingLensHeight(400, 500, 440, bad), draggedBuildingLensHeight(400, 500, 440, 2 / 3));
    }
  });
});

describe("the panel's width", () => {
  it("and its chrome fill the band beside the tool columns, and no more", () => {
    // The band left free beside the left-aligned tool columns, at the layout's
    // reference resolution. C# sizes the panel (BuildingLensWidth.Max, generated)
    // and the UI adds its chrome, so a wider chrome pushes the panel past it.
    assert.equal(BUILDING_LENS_MAX_WIDTH + BUILDING_LENS_PANEL_CHROME_WIDTH, 1476);
  });
});

describe("Table column widths", () => {
  // The widths the seven cells want when every column is set to a comfortable
  // width by hand. Taken from the whole assembly, control pane included,
  // rather than from the rows box alone, which undercounts the room.
  it("gives every column its comfortable width at the default assembly", async () => {
    const { getBuildingLensColumnWidths, BUILDING_LENS_COLUMN_MAX, BUILDING_LENS_PANEL_CHROME_WIDTH } = await import(
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
    const { getBuildingLensColumnWidths, BUILDING_LENS_MIN_WIDTH } = await import(
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
    // draws — and a narrower cell clips its last character.
    const { BUILDING_LENS_COLUMN_MIN, BUILDING_LENS_COLUMN_MAX } = await import("../src/domain/buildingLensLayout.ts");

    // The figure does not scale with the panel, so BOTH bounds must hold it:
    // raising only the minimum leaves a cell already at its maximum clipping
    // on a narrow panel.
    assert.ok(BUILDING_LENS_COLUMN_MIN.upkeep >= 112, `upkeep min is ${BUILDING_LENS_COLUMN_MIN.upkeep}rem`);
    assert.ok(BUILDING_LENS_COLUMN_MAX.upkeep >= 112, `upkeep max is ${BUILDING_LENS_COLUMN_MAX.upkeep}rem`);
  });
});

describe("sizes the stylesheets draw", () => {
  // Read from each sheet's `:export`, so the numbers cannot drift from the
  // sheet; what is checked here is that the export sums the rules it names.
  it("the row's furniture is what the header and the row spend beside the name", () => {
    const header = declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", ".columnHeader[data-rows-scrollable=true]");
    const row = declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", ".rowSelect");
    const thumbnail = declarationsOf("mods/BuildingCatalog/buildingCatalog.module.scss", ".thumbnail");

    // The trailing reserve and the rows' scrollbar, the row's left padding, the
    // thumbnail and its gap.
    const drawn = rem(header["padding-right"]) + rem(sides(row.padding)[3]) + rem(thumbnail.width) + rem(thumbnail["margin-right"]);

    assert.ok(Number.isFinite(drawn) && drawn > 0, `drawn ${drawn}`);
    assert.equal(BUILDING_LENS_TABLE_ROW_FURNITURE, drawn);
  });

  it("the control pane's total is its width and the gap beside it", () => {
    const pane = declarationsOf("mods/LensControlPane/lensControlPane.module.scss", ".pane");

    assert.equal(BUILDING_LENS_CONTROL_PANE_TOTAL, rem(pane.width) + rem(pane["margin-left"]));
  });

  it("a drag measures against the strip's real height", () => {
    const strip = declarationsOf("mods/LensResizeHandle/lensResizeHandle.module.scss", ".resizeHandle");

    assert.equal(LENS_RESIZE_HANDLE_HEIGHT, rem(strip.height));
  });
});

describe("the metric columns fit the room beside the name", () => {
  // The room is what the row really has: assembly − control pane − the
  // panel's chrome around the rows − the row's own furniture − the name's
  // basis. At a typical panel that leaves enough for the 586rem maximum.
  it("is the measured row less the furniture and the name's basis at the default assembly", async () => {
    const { tableColumnRoom, BUILDING_LENS_PANEL_CHROME_WIDTH, BUILDING_LENS_TABLE_ROW_FURNITURE } = await import("../src/domain/buildingLensLayout.ts");

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
    const { getBuildingLensColumnWidths, tableColumnRoom, BUILDING_LENS_PANEL_CHROME_WIDTH } = await import("../src/domain/buildingLensLayout.ts");
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
