import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { assetMenuRowWidth } from "../../src/domain/assetMenuLayout";
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

  it("opens a new player at the game's own width, with the pane beside it", () => {
    assert.deepEqual(read(), {
      step: 1,
      menuWidth: 706,
      paneShown: true,
      snaps: [{ step: 1, width: 706 }, { step: 2, width: 893 }, { step: 3, width: 1091 }],
    });
  });

  it("draws step 3 as 0.2.4's row: the pane ends at the social column", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
    const { menuWidth } = read();

    assert.equal(menuWidth, 1091);
    assert.equal(396 + assetMenuRowWidth(menuWidth, true), 1872);
  });

  it("draws a step that does not fit beside the pane as the widest that does, and gives it back when the pane hides", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 5);
    assert.equal(read().menuWidth, 1091);

    setBinding("BetterBuildingMenu", "ControlPaneShown", false);
    const hidden = read();
    assert.equal(hidden.menuWidth, 1475);
    assert.equal(assetMenuRowWidth(hidden.menuWidth, false), 1475);
    assert.deepEqual(hidden.snaps.map((snap) => snap.step), [1, 2, 3, 4, 5]);
  });

  it("narrows step 3 to the room beside the pane at larger text", () => {
    setBinding("BetterBuildingMenu", "AssetMenuWidthStep", 3);
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
