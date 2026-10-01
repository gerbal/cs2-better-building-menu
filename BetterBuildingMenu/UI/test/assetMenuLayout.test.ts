import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, rem, sides } from "./harness/compiledCss.ts";
import {
  getAssetMenuRowGeometry,
  getAssetMenuDensity,
  getAssetMenuMetricLabel,
  getAssetMenuMetricTextScale,
  getAssetMenuCatalogMaxHeight,
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
  ASSET_MENU_MIN_HEIGHT,
  ASSET_MENU_MAX_HEIGHT,
  ASSET_MENU_DEFAULT_HEIGHT,
  CONTROL_PANE_TOTAL,
  ASSET_MENU_CHROME_WIDTH,
  ASSET_MENU_TABLE_ROW_FURNITURE,
  ASSET_MENU_RESIZE_HANDLE_HEIGHT,
  ASSET_MENU_CATALOG_FILL,
  ASSET_MENU_CATALOG_MIN_WIDTH,
  ASSET_MENU_WIDTH_HANDLE_WIDTH,
  REM_IN_PX_AT_720P,
  assetMenuRowWidth,
  catalogLayoutWidth,
  draggedCatalogWidth,
  releasedCatalogWidth,
  resolveCatalogWidth,
} from "../src/domain/assetMenuLayout.ts";
import { ASSET_MENU_MAX_WIDTH } from "../src/domain/sharedContracts.generated.ts";


describe("Asset menu geometry", () => {
  it("maps exact outer-width boundaries to density tiers", () => {
    assert.equal(getAssetMenuDensity(735), "compact");
    assert.equal(getAssetMenuDensity(799), "compact");
    assert.equal(getAssetMenuDensity(800), "default");
    assert.equal(getAssetMenuDensity(999), "default");
    assert.equal(getAssetMenuDensity(1000), "expanded");
    assert.equal(getAssetMenuDensity(1235), "expanded");
  });

  it("abbreviates metric headers only in compact density", () => {
    assert.equal(getAssetMenuMetricLabel("upkeep", "compact", "Upkeep"), "Upk");
    assert.equal(getAssetMenuMetricLabel("workers", "compact", "Workers"), "Wkr");
    assert.equal(getAssetMenuMetricLabel("upkeep", "default", "Unterhalt"), "Unterhalt");
    assert.equal(getAssetMenuMetricLabel("upkeep", "expanded", "Unterhalt"), "Unterhalt");
  });

  it("uses a readable metric text scale outside compact density", () => {
    assert.equal(getAssetMenuMetricTextScale("compact"), "compact");
    assert.equal(getAssetMenuMetricTextScale("default"), "readable");
    assert.equal(getAssetMenuMetricTextScale("expanded"), "readable");
  });

  it("keeps the default and compact row geometry dense but readable", () => {
    assert.deepEqual(getAssetMenuRowGeometry("default"), {
      rowHeight: 92,
      selectorHeight: 88,
      identityHeight: 72,
      selectorVerticalPadding: 2,
    });
    assert.deepEqual(getAssetMenuRowGeometry("compact"), {
      rowHeight: 84,
      selectorHeight: 80,
      identityHeight: 72,
      selectorVerticalPadding: 2,
    });
  });

  it("budgets the catalog below the shell chrome at the 1280x720 render target", () => {
    assert.equal(getAssetMenuCatalogMaxHeight(720), 765);
    assert.equal(getAssetMenuCatalogMaxHeight(1080), 870);
    assert.equal(getAssetMenuCatalogMaxHeight(Number.NaN), 765);
  });
});

describe("Asset menu catalog height", () => {
  it("holds the drag inside the range", () => {
    assert.equal(clampAssetMenuHeight(ASSET_MENU_MIN_HEIGHT - 50), ASSET_MENU_MIN_HEIGHT);
    assert.equal(clampAssetMenuHeight(ASSET_MENU_MAX_HEIGHT + 50), ASSET_MENU_MAX_HEIGHT);
    assert.equal(clampAssetMenuHeight(500), 500);
  });

  it("falls back to the default rather than passing a non-finite height through", () => {
    // It goes straight into an inline style: height: NaNrem leaves the catalog
    // unsized rather than merely the wrong size.
    assert.equal(clampAssetMenuHeight(Number.NaN), ASSET_MENU_DEFAULT_HEIGHT);
    assert.equal(clampAssetMenuHeight(Number.POSITIVE_INFINITY), ASSET_MENU_DEFAULT_HEIGHT);
  });

  it("grows when the top edge is dragged upward", () => {
    // The asset menu is bottom-anchored and the handle is on its top edge, so a
    // smaller clientY means a taller asset menu. Getting this sign wrong gives a
    // handle that shrinks the asset menu when you pull it open.
    const taller = draggedAssetMenuHeight(400, 500, 400);
    const shorter = draggedAssetMenuHeight(400, 500, 600);

    assert.ok(taller > 400);
    assert.ok(shorter < 400);
  });

  it("treats a non-finite pointer as no movement", () => {
    assert.equal(draggedAssetMenuHeight(400, Number.NaN, 300), 400);
  });

  it("keeps the edge under the cursor at any scale", () => {
    // 60px up is 60rem at 1080p (1px per rem) and 90rem at 720p (2/3px per
    // rem). A fixed ratio would run the asset menu 1.5x ahead of the cursor at 1080p.
    assert.equal(draggedAssetMenuHeight(400, 500, 440, 1), 460);
    assert.equal(draggedAssetMenuHeight(400, 500, 440, 2 / 3), 490);
    assert.equal(draggedAssetMenuHeight(400, 500, 440, 2), 430);
  });

  it("measures rem off the drawn resize strip", async () => {
    const { pxPerRemFrom, ASSET_MENU_RESIZE_HANDLE_HEIGHT } = await import("../src/domain/assetMenuLayout.ts");
    // 14rem drawn 14px tall at 1080p, 21px at 1440p.
    assert.equal(pxPerRemFrom(14, ASSET_MENU_RESIZE_HANDLE_HEIGHT), 1);
    assert.equal(pxPerRemFrom(21, ASSET_MENU_RESIZE_HANDLE_HEIGHT), 1.5);
    // Cohtml's pre-layout zero, or no rect at all, is no measurement.
    for (const bad of [0, -3, Number.NaN, null, undefined]) {
      assert.equal(pxPerRemFrom(bad, ASSET_MENU_RESIZE_HANDLE_HEIGHT), undefined);
    }
  });

  it("falls back to the 720p ratio when the measurement is unusable", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      assert.equal(draggedAssetMenuHeight(400, 500, 440, bad), draggedAssetMenuHeight(400, 500, 440, 2 / 3));
    }
  });
});

describe("the asset menu's width", () => {
  it("and its chrome fill the band beside the tool columns, and no more", () => {
    // The band left free beside the left-aligned tool columns, at the layout's
    // reference resolution. C# sizes the assembly (AssetMenuWidth.Max, generated)
    // and the UI adds its chrome, so a wider chrome pushes the assembly past it.
    assert.equal(ASSET_MENU_MAX_WIDTH + ASSET_MENU_CHROME_WIDTH, 1476);
  });
});

describe("Table column widths", () => {
  // The widths the seven cells want when every column is set to a comfortable
  // width by hand. Taken from the whole assembly, control pane included,
  // rather than from the rows box alone, which undercounts the room.
  it("gives every column its comfortable width at the default assembly", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MAX, ASSET_MENU_CHROME_WIDTH } = await import(
      "../src/domain/assetMenuLayout.ts"
    );

    assert.deepEqual(getAssetMenuColumnWidths(ASSET_MENU_MAX_WIDTH + ASSET_MENU_CHROME_WIDTH), ASSET_MENU_COLUMN_MAX);
  });

  it("never goes below the minimum table, however narrow the build menu", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MIN, ASSET_MENU_MIN_WIDTH } = await import(
      "../src/domain/assetMenuLayout.ts"
    );

    assert.deepEqual(getAssetMenuColumnWidths(ASSET_MENU_MIN_WIDTH), ASSET_MENU_COLUMN_MIN);
  });

  it("hands the name a real share of a narrow build menu", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MAX, ASSET_MENU_MIN_WIDTH } = await import(
      "../src/domain/assetMenuLayout.ts"
    );

    const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
    const reclaimed = sum(ASSET_MENU_COLUMN_MAX) - sum(getAssetMenuColumnWidths(ASSET_MENU_MIN_WIDTH));

    // Enough to matter: a name column of 111px was rendering "EU Commercial
    // Gas S…" for three different buildings.
    assert.equal(reclaimed >= 100, true);
  });

  it("moves monotonically between the two ends, in every column", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_MIN_WIDTH } = await import(
      "../src/domain/assetMenuLayout.ts"
    );

    let previous = getAssetMenuColumnWidths(ASSET_MENU_MIN_WIDTH);

    for (let w = ASSET_MENU_MIN_WIDTH; w <= ASSET_MENU_MAX_WIDTH; w += 25) {
      const widths = getAssetMenuColumnWidths(w);
      for (const key of Object.keys(widths) as (keyof typeof widths)[]) {
        assert.ok(widths[key] >= previous[key], `${key} fell from ${previous[key]} to ${widths[key]} at ${w}`);
      }
      previous = widths;
    }
  });

  it("clamps a width outside the supported range", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MAX, ASSET_MENU_COLUMN_MIN } = await import(
      "../src/domain/assetMenuLayout.ts"
    );

    assert.deepEqual(getAssetMenuColumnWidths(50), ASSET_MENU_COLUMN_MIN);
    assert.deepEqual(getAssetMenuColumnWidths(99999), ASSET_MENU_COLUMN_MAX);
  });

  it("returns whole units so the header cannot land off the rows", async () => {
    const { getAssetMenuColumnWidths } = await import("../src/domain/assetMenuLayout.ts");

    // The table has already been fixed once for a header that drifted from its
    // rows; a fractional width would reintroduce it a pixel at a time.
    for (const width of Object.values(getAssetMenuColumnWidths(1400))) {
      assert.equal(Number.isInteger(width), true);
    }
  });

  it("says something rather than nothing for a nonsense width", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MIN } = await import(
      "../src/domain/assetMenuLayout.ts"
    );

    assert.deepEqual(getAssetMenuColumnWidths(Number.NaN), ASSET_MENU_COLUMN_MIN);
  });
});

describe("the Upkeep column at the narrowest build menu", () => {
  it("holds a per-kilometre figure without clipping", async () => {
    // A road's upkeep is "¢2,437 /km/mo." — the widest figure the column ever
    // draws — and a narrower cell clips its last character.
    const { ASSET_MENU_COLUMN_MIN, ASSET_MENU_COLUMN_MAX } = await import("../src/domain/assetMenuLayout.ts");

    // The figure does not scale with the build menu, so BOTH bounds must hold it:
    // raising only the minimum leaves a cell already at its maximum clipping
    // on a narrow build menu.
    assert.ok(ASSET_MENU_COLUMN_MIN.upkeep >= 112, `upkeep min is ${ASSET_MENU_COLUMN_MIN.upkeep}rem`);
    assert.ok(ASSET_MENU_COLUMN_MAX.upkeep >= 112, `upkeep max is ${ASSET_MENU_COLUMN_MAX.upkeep}rem`);
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
    assert.equal(ASSET_MENU_TABLE_ROW_FURNITURE, drawn);
  });

  it("the control pane's total is its width and the gap beside it", () => {
    const pane = declarationsOf("mods/ControlPane/controlPane.module.scss", ".pane");

    assert.equal(CONTROL_PANE_TOTAL, rem(pane.width) + rem(pane["margin-left"]));
  });

  it("a drag measures against the strip's real height", () => {
    const strip = declarationsOf("mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss", ".resizeHandle");

    assert.equal(ASSET_MENU_RESIZE_HANDLE_HEIGHT, rem(strip.height));
  });

  it("a width drag measures against the strip's real width, and the strip stays out of the pane", () => {
    const strip = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthHandle");
    const pane = declarationsOf("mods/ControlPane/controlPane.module.scss", ".pane");

    assert.equal(ASSET_MENU_WIDTH_HANDLE_WIDTH, rem(strip.width));
    // Centred on the build menu's edge: half inside it, half in the gap.
    assert.equal(strip.right, `-${ASSET_MENU_WIDTH_HANDLE_WIDTH / 2}rem`);
    assert.ok(ASSET_MENU_WIDTH_HANDLE_WIDTH / 2 <= rem(pane["margin-left"]), "the strip reaches into the pane");
    assert.equal(strip.cursor, "url(cursor://horizontal-can-resize)");
  });
});

describe("the metric columns fit the room beside the name", () => {
  // The room is what the row really has: assembly − control pane − the
  // build menu's chrome around the rows − the row's own furniture − the name's
  // basis. At a typical width that leaves enough for the 586rem maximum.
  it("is the measured row less the furniture and the name's basis at the default assembly", async () => {
    const { tableColumnRoom, ASSET_MENU_CHROME_WIDTH, ASSET_MENU_TABLE_ROW_FURNITURE } = await import("../src/domain/assetMenuLayout.ts");

    assert.equal(tableColumnRoom(ASSET_MENU_MAX_WIDTH + ASSET_MENU_CHROME_WIDTH), 1026 - ASSET_MENU_TABLE_ROW_FURNITURE - 260);
  });

  it("holds the set to the room where the preference would overrun it", async () => {
    // A 1350rem assembly has about 500rem beside a 260rem name; the columns
    // take exactly that, not the 586 they would prefer, so the name keeps its
    // basis instead of being the one flex item that yields.
    const { getAssetMenuColumnWidths, tableColumnRoom } = await import("../src/domain/assetMenuLayout.ts");
    const room = tableColumnRoom(1350);
    const total = Object.values(getAssetMenuColumnWidths(1350)).reduce((a, b) => a + b, 0);

    assert.ok(room > 478 && room < 586, `room ${room}rem sits between the minimum and comfortable sets`);
    assert.ok(Math.abs(total - room) <= 3, `columns sum to ${total}rem of ${room}`);
  });

  it("keeps every column's share of the room in proportion to its preference", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MAX } = await import("../src/domain/assetMenuLayout.ts");
    const widths = getAssetMenuColumnWidths(1350);

    assert.ok(widths.upkeep > widths.cost && widths.capacity > widths.cost, "upkeep and capacity stay the widest");
    assert.ok(widths.upkeep / widths.level > ASSET_MENU_COLUMN_MAX.upkeep / ASSET_MENU_COLUMN_MAX.level * 0.9);
  });

  it("shrinks the room as the text scale grows the figures", async () => {
    // At 125 % the cells' figures are wider by the same ratio as the font,
    // so the set that fits is the room over that ratio: still at most the
    // room, and still whole units.
    const { getAssetMenuColumnWidths, tableColumnRoom, ASSET_MENU_CHROME_WIDTH } = await import("../src/domain/assetMenuLayout.ts");
    const outer = ASSET_MENU_MAX_WIDTH + ASSET_MENU_CHROME_WIDTH;
    const total = Object.values(getAssetMenuColumnWidths(outer, 1.25)).reduce((a, b) => a + b, 0);

    assert.ok(total <= tableColumnRoom(outer) + 3, `columns sum to ${total}rem of ${tableColumnRoom(outer)}`);
    assert.ok(total > tableColumnRoom(outer) - 8, `columns leave ${tableColumnRoom(outer) - total}rem unused`);
  });

  it("does not cap where there is room to spare", async () => {
    const { getAssetMenuColumnWidths, ASSET_MENU_COLUMN_MAX } = await import("../src/domain/assetMenuLayout.ts");
    assert.deepEqual(getAssetMenuColumnWidths(3000), ASSET_MENU_COLUMN_MAX);
  });
});

// The band at the layout's reference resolution: C#'s width and the UI's chrome.
const BAND = ASSET_MENU_MAX_WIDTH + ASSET_MENU_CHROME_WIDTH;

describe("the build menu's width", () => {
  it("fills the room: beside the pane, and the whole band without it", () => {
    assert.equal(resolveCatalogWidth(ASSET_MENU_CATALOG_FILL, BAND, true), 1091);
    assert.equal(resolveCatalogWidth(ASSET_MENU_CATALOG_FILL, BAND, false), 1476);
  });

  it("holds a chosen width between the minimum and the room", () => {
    assert.equal(resolveCatalogWidth(900, BAND, true), 900);
    assert.equal(resolveCatalogWidth(100, BAND, true), ASSET_MENU_CATALOG_MIN_WIDTH);
    assert.equal(resolveCatalogWidth(5000, BAND, false), 1476);
  });

  it("draws a width that no longer fits at the room, and gives it back when the pane goes", () => {
    assert.equal(resolveCatalogWidth(1200, BAND, true), 1091);
    assert.equal(resolveCatalogWidth(1200, BAND, false), 1200);
  });

  it("reads anything that is not a width as fill", () => {
    for (const width of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      assert.equal(resolveCatalogWidth(width, BAND, true), 1091, String(width));
    }
  });

  it("sizes the row to what it holds, so no empty stretch of it takes the mouse", () => {
    assert.equal(assetMenuRowWidth(900, true), 900 + CONTROL_PANE_TOTAL);
    assert.equal(assetMenuRowWidth(900, false), 900);
  });

  it("hands the table the row it was tuned against, so today's width budgets as before", () => {
    assert.equal(catalogLayoutWidth(1091), BAND);
  });
});

describe("dragging the build menu's width", () => {
  it("follows the pointer rightward at the measured scale", () => {
    assert.equal(draggedCatalogWidth(900, 500, 560, BAND, true, 2), 930);
  });

  it("stops at the minimum however far left it goes, and never wraps round to fill", () => {
    assert.equal(draggedCatalogWidth(900, 500, -5000, BAND, true, 1), ASSET_MENU_CATALOG_MIN_WIDTH);
  });

  it("stops at the room", () => {
    assert.equal(draggedCatalogWidth(900, 500, 5000, BAND, true, 1), 1091);
    assert.equal(draggedCatalogWidth(900, 500, 5000, BAND, false, 1), 1476);
  });

  it("falls back to the 720p scale when the strip could not be measured", () => {
    assert.equal(draggedCatalogWidth(900, 500, 520, BAND, true), 900 + 20 / REM_IN_PX_AT_720P);
  });
});

describe("where a width drag lands", () => {
  it("stores fill when it ends against the room", () => {
    assert.equal(releasedCatalogWidth(1091, BAND, true), ASSET_MENU_CATALOG_FILL);
    assert.equal(releasedCatalogWidth(1089.5, BAND, true), ASSET_MENU_CATALOG_FILL);
    assert.equal(releasedCatalogWidth(1476, BAND, false), ASSET_MENU_CATALOG_FILL);
  });

  it("stores the width anywhere else", () => {
    assert.equal(releasedCatalogWidth(1000, BAND, true), 1000);
  });
});
