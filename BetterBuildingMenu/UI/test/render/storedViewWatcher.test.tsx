import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { setBinding, resetBindings } from "../harness/stubs/cs2-api";
import { getAssetMenuView, resetAssetMenuView, setAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { chooseViewMode } from "../../src/domain/viewModeChoice";
import { DEFAULT_VIEW_MODE } from "../../src/mods/GroupedResults/ViewModeBar";
import { StoredViewWatcher } from "../../src/mods/StoredViewWatcher/StoredViewWatcher";

const stored = (view: string) => setBinding("BetterBuildingMenu", "AssetMenuViewMode", view);

/** Mounts the watcher with this session's pick already made, as the pane makes it. */
const mounted = (sessionPick: string): ReactTestRenderer => {
  setAssetMenuView({ viewMode: sessionPick });
  let root: ReactTestRenderer | undefined;
  act(() => {
    root = create(<StoredViewWatcher />);
  });
  return root!;
};

describe("the stored-view watcher", () => {
  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
  });

  it("drops the session's pick when a reset empties the stored view, so the menu draws Cards", () => {
    stored("list");
    const root = mounted("table");

    act(() => stored(""));
    act(() => root.unmount());

    assert.equal(getAssetMenuView().viewMode, "");
    assert.equal(chooseViewMode(getAssetMenuView().viewMode, "", DEFAULT_VIEW_MODE), "cards");
  });

  it("drops the session's pick when the first answer is empty, a reset made while it was unmounted", () => {
    // The stored view is empty when the watcher mounts, though a pick exists.
    stored("");
    const root = mounted("table");
    act(() => root.unmount());

    assert.equal(getAssetMenuView().viewMode, "");
  });

  it("keeps the session's pick when the first answer carries a stored view", () => {
    stored("list");
    const root = mounted("table");
    act(() => root.unmount());

    assert.equal(getAssetMenuView().viewMode, "table");
  });

  it("keeps the session's pick when C# echoes it back", () => {
    stored("list");
    const root = mounted("grid");

    act(() => stored("grid"));
    act(() => root.unmount());

    assert.equal(getAssetMenuView().viewMode, "grid");
  });
});
