import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationsOf, rem } from "./harness/compiledCss.ts";
import {
  clampAssetMenuHeight,
  draggedAssetMenuHeight,
  dragDistanceRem,
  ASSET_MENU_MIN_HEIGHT,
  ASSET_MENU_MAX_HEIGHT,
  ASSET_MENU_DEFAULT_HEIGHT,
  CONTROL_PANE_TOTAL,
  ASSET_MENU_RESIZE_HANDLE_HEIGHT,
  ASSET_MENU_WIDTH_HANDLE_WIDTH,
  ASSET_MENU_WIDTH_HANDLE_REACH,
  REM_IN_PX_AT_720P,
  drawnBodyHeight,
  drawnBoxHeight,
  BOX_BOTTOM,
  TOP_HUD_ALLOWANCE,
  TAB_ROW_BAND,
  ASSET_MENU_BOX_CHROME,
  assetMenuBoxHeight,
  TOP_CHROME_HEIGHT,
  TOP_EDGE_HEIGHT,
  POPOVER_FILTER_HEIGHT,
} from "../src/domain/assetMenuLayout.ts";

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

describe("sizes the stylesheets draw", () => {

  it("the control pane's total is its width and the gap beside it", () => {
    const pane = declarationsOf("mods/ControlPane/controlPane.module.scss", ".pane");

    assert.equal(CONTROL_PANE_TOTAL, rem(pane.width) + rem(pane["margin-left"]));
  });

  it("a drag measures against the strip's real height", () => {
    const strip = declarationsOf("mods/AssetMenuResizeHandle/assetMenuResizeHandle.module.scss", ".resizeHandle");

    assert.equal(ASSET_MENU_RESIZE_HANDLE_HEIGHT, rem(strip.height));
  });

  it("a top-edge drag measures against the edge's real height", () => {
    const edge = declarationsOf("mods/TopEdge/topEdge.module.scss", ".topEdge");

    assert.equal(TOP_EDGE_HEIGHT, 8);
    assert.equal(TOP_EDGE_HEIGHT, rem(edge.height));
  });

  it("a width drag measures against the strip's real width, and the strip lies inside the build menu", () => {
    const strip = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthHandle");

    assert.equal(ASSET_MENU_WIDTH_HANDLE_WIDTH, rem(strip.width));
    assert.equal(strip.right, "0");
    assert.equal(strip.cursor, "url(cursor://horizontal-can-resize)");
  });

  it("a press on the reach beside the pane measures against the reach's real width", () => {
    const reach = declarationsOf("mods/AssetMenuWidthHandle/assetMenuWidthHandle.module.scss", ".widthReach");

    assert.equal(ASSET_MENU_WIDTH_HANDLE_REACH, rem(reach.width));
  });

  it("a popover's room is budgeted at FILTER's height, which its list scrolls past", () => {
    const sheet = "mods/ControlPopover/controlPopover.module.scss";
    const drawn = rem(declarationsOf(sheet, ".filterBody")["max-height"]) + 2 * rem(declarationsOf(sheet, ".popover").padding);

    assert.equal(POPOVER_FILTER_HEIGHT, 300);
    assert.equal(POPOVER_FILTER_HEIGHT, drawn);
  });
});

describe("a drag's distance", () => {
  it("is the pixels moved over the pixels per rem, from the first point to the second", () => {
    assert.equal(dragDistanceRem(500, 520, 2), 10);
    assert.equal(dragDistanceRem(520, 500, 2), -10);
  });

  it("falls back to the 720p scale when the strip could not be measured, and is zero for a point it cannot read", () => {
    assert.equal(dragDistanceRem(500, 520), 20 / REM_IN_PX_AT_720P);
    assert.equal(dragDistanceRem(500, 520, 0), 20 / REM_IN_PX_AT_720P);
    assert.equal(dragDistanceRem(Number.NaN, 520, 1), 0);
  });
});

describe("the list under the tab row", () => {
  it("is the box less the chrome as drawn, so the box keeps vanilla's 208 at the default", () => {
    assert.equal(TAB_ROW_BAND, 29.75);
    assert.equal(assetMenuBoxHeight(ASSET_MENU_DEFAULT_HEIGHT), 208);
    for (const stored of [ASSET_MENU_DEFAULT_HEIGHT, 200, 300]) {
      assert.equal(TOP_CHROME_HEIGHT + drawnBodyHeight(stored) + TAB_ROW_BAND, assetMenuBoxHeight(stored), String(stored));
    }
  });

  it("draws above the body the chrome the stylesheets draw", () => {
    const band = declarationsOf("mods/TopRow/topRow.module.scss", ".topBand");
    const row = declarationsOf("mods/TopRow/topRow.module.scss", ".topRow");

    assert.equal(TOP_CHROME_HEIGHT, rem(band["padding-top"]) + rem(row.height) + rem(band["padding-bottom"]));
    assert.equal(TOP_CHROME_HEIGHT + TAB_ROW_BAND, ASSET_MENU_BOX_CHROME);
  });

  it("is a dragged height and 63.75, in every look", () => {
    assert.equal(ASSET_MENU_BOX_CHROME, 63.75);
    assert.equal(assetMenuBoxHeight(300), 363.75);
    assert.equal(assetMenuBoxHeight(ASSET_MENU_MAX_HEIGHT), ASSET_MENU_MAX_HEIGHT + 63.75);
  });

  it("never draws below the drag's floor", () => {
    assert.equal(drawnBodyHeight(ASSET_MENU_MIN_HEIGHT), ASSET_MENU_MIN_HEIGHT);
    assert.equal(drawnBodyHeight(Number.NaN), drawnBodyHeight(ASSET_MENU_DEFAULT_HEIGHT));
  });

  it("follows the stored height from the drag's floor to the room under the top HUD, so the top edge follows the pointer", () => {
    for (const stored of [ASSET_MENU_MIN_HEIGHT, 120, 137.75, ASSET_MENU_DEFAULT_HEIGHT, 300, 600, 830.25]) {
      assert.equal(drawnBodyHeight(stored), stored, String(stored));
    }
  });

  it("is the drawn box less its chrome where a tall stored height stops at the room under the top HUD", () => {
    for (const stored of [900, ASSET_MENU_MAX_HEIGHT]) {
      assert.equal(TOP_CHROME_HEIGHT + drawnBodyHeight(stored) + TAB_ROW_BAND, drawnBoxHeight(stored), String(stored));
    }
  });
});

describe("the box's drawn height", () => {
  // The room from the box's bottom edge up to the band the top HUD holds.
  const room = BOX_BOTTOM - TOP_HUD_ALLOWANCE;

  it("is the stored height and the chrome while that fits under the top HUD", () => {
    assert.equal(drawnBoxHeight(ASSET_MENU_DEFAULT_HEIGHT), 208);
    assert.equal(drawnBoxHeight(600), 663.75);
  });

  it("stops at the room under the top HUD, so its top row never sits under the HUD", () => {
    assert.equal(room, 894);
    assert.equal(drawnBoxHeight(900), room);
    assert.equal(drawnBoxHeight(ASSET_MENU_MAX_HEIGHT), room);
    assert.equal(drawnBoxHeight(room - ASSET_MENU_BOX_CHROME), room, "the tallest stored height drawn whole");
  });
});
