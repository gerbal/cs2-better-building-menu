import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type Command,
  clearAssetMenuScopeCommand,
  commitAssetMenuCatalogWidthCommand,
  commitAssetMenuHeightCommand,
  resetAssetMenuCommand,
  searchEverythingCommand,
  setAssetMenuCatalogWidthCommand,
  setAssetMenuCategoryCommand,
  setAssetMenuCommand,
  setAssetMenuHeightCommand,
  setAssetMenuSchoolTierCommand,
  setAssetMenuStripTabCommand,
  setAssetMenuViewModeCommand,
  setBuildingCatalogGroupByCommand,
  setControlPaneShownCommand,
  setCurrentPrefabCommand,
} from "../src/domain/commands.ts";

describe("commands to C#", () => {
  it("names each command after the trigger C# registers", () => {
    assert.deepEqual(
      [
        setCurrentPrefabCommand(17),
        searchEverythingCommand(),
        setAssetMenuCommand("Parks"),
        setAssetMenuCategoryCommand("SmallRoads"),
        setAssetMenuStripTabCommand("branch"),
        setAssetMenuSchoolTierCommand(2),
        clearAssetMenuScopeCommand(),
        resetAssetMenuCommand(),
        setBuildingCatalogGroupByCommand("theme"),
        setAssetMenuViewModeCommand("list"),
        setAssetMenuHeightCommand(420),
        commitAssetMenuHeightCommand(),
        setAssetMenuCatalogWidthCommand(900),
        commitAssetMenuCatalogWidthCommand(),
        setControlPaneShownCommand(false),
      ],
      [
        { method: "SetCurrentPrefab", args: [17] },
        { method: "SearchEverything", args: [] },
        { method: "SetAssetMenu", args: ["Parks"] },
        { method: "SetAssetMenuCategory", args: ["SmallRoads"] },
        { method: "SetAssetMenuStripTab", args: ["branch"] },
        { method: "SetAssetMenuSchoolTier", args: [2] },
        { method: "ClearAssetMenuScope", args: [] },
        { method: "ResetAssetMenu", args: [] },
        { method: "SetBuildingCatalogGroupBy", args: ["theme"] },
        { method: "SetAssetMenuViewMode", args: ["list"] },
        { method: "SetAssetMenuHeight", args: [420] },
        { method: "CommitAssetMenuHeight", args: [] },
        { method: "SetAssetMenuCatalogWidth", args: [900] },
        { method: "CommitAssetMenuCatalogWidth", args: [] },
        { method: "SetControlPaneShown", args: [false] },
      ],
    );
  });

  it("types a command by the trigger table generated from C#", () => {
    // Checked by the typecheck: each line must be refused, or the directive above it fails.
    // @ts-expect-error no system registers this name
    const unregistered: Command = { method: "NoSuchTrigger", args: [] };
    // @ts-expect-error SetAssetMenuHeight reads a number
    const mistyped: Command = { method: "SetAssetMenuHeight", args: ["tall"] };
    // @ts-expect-error SetVanillaToolbarSelection reads four arguments
    const short: Command = { method: "SetVanillaToolbarSelection", args: ["", ""] };

    assert.equal([unregistered, mistyped, short].length, 3);
  });
});
