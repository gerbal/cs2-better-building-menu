import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { CONTROL_PANE_TOTAL } from "../../src/domain/assetMenuLayout";
import { boxPlacement } from "../../src/domain/widthSteps";
import { useAssetMenuLayout, type AssetMenuLayout } from "../../src/mods/useAssetMenuLayout";

const globals = globalThis as unknown as Record<string, unknown>;
let layout: AssetMenuLayout;
const Probe = () => {
  layout = useAssetMenuLayout();
  return null;
};
const read = () => {
  act(() => {
    create(<Probe />);
  });
  return layout;
};
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

describe("the asset menu's layout", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  afterEach(() => {
    delete globals.window;
  });

  it("opens a new player at the game's own width, with no pane beside it", () => {
    assert.deepEqual(read(), {
      step: 1,
      drawnStep: 1,
      menuWidth: 706,
      paneShown: false,
      snaps: [706, 893, 1091, 1280, 1475].map((width, index) => ({ step: index + 1, width })),
      screen: { aspect: 16 / 9, textScale: 1, paneShown: false },
    });
  });

  it("reads the step the box draws apart from the stored one beside the pane", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    const layout = read();

    assert.equal(layout.step, 5);
    assert.equal(layout.drawnStep, 3);
  });

  it("draws step 3 beside the pane as 0.2.4's row: the pane ends at the social column", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    const { menuWidth, screen } = read();

    assert.equal(menuWidth, 1091);
    assert.equal(boxPlacement(menuWidth, screen).left + menuWidth + CONTROL_PANE_TOTAL, 1872);
  });

  it("draws a step that does not fit beside the pane as the widest that does, and gives it back when the pane hides", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    assert.equal(read().menuWidth, 1091);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const hidden = read();
    assert.equal(hidden.menuWidth, 1475);
    assert.equal(boxPlacement(hidden.menuWidth, hidden.screen).left + hidden.menuWidth, 1871);
    assert.deepEqual(hidden.snaps.map((snap) => snap.step), [1, 2, 3, 4, 5]);
  });

  it("narrows step 3 to the room beside the pane at larger text", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    setBinding("BetterBuildingMenu", "ControlPaneShown", true);
    setBinding("options", "textScale", 1.1);

    near(read().menuWidth, 1072);
  });

  it("sizes the steps to the screen it is drawn on", () => {
    globals.window = { innerWidth: 2520, innerHeight: 1080 };
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 2);

    assert.equal(read().menuWidth, 1039);
  });

  it("draws a step it cannot use as the first", () => {
    for (const step of [0, 9, -1, 2.5, "3"]) {
      setBinding("BetterBuildingMenu", "AssetMenuWidthStep", step);
      const drawn = read();

      assert.equal(drawn.step, 1, String(step));
      assert.equal(drawn.menuWidth, 706, String(step));
    }
  });
});
