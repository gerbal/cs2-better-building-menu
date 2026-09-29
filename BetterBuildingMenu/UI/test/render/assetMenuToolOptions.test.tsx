import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { VanillaComponentResolver } from "../../src/mods/VanillaComponentResolver/VanillaComponentResolver";
import { AssetMenuToolOptions } from "../../src/mods/AssetMenuToolOptions/AssetMenuToolOptions";

const availability = {
  id: "availability",
  label: "Availability",
  options: [
    { id: "Locked", label: "Locked", selected: true },
    { id: "Unlocked", label: "Unlocked", selected: false },
    { id: "AlreadyBuilt", label: "Already built", selected: false },
  ],
};

// Vanilla's bank: the Theme and Pack sections the game draws itself.
const vanillaBank = () => (
  <div data-bank="true">
    <div data-vanilla="Theme" />
    <div data-vanilla="Pack" />
  </div>
);
const Bank = AssetMenuToolOptions(vanillaBank) as () => JSX.Element;

describe("the tool-options bank", () => {
  let root: ReactTestRenderer | undefined;

  const render = () => act(() => {
    root = create(<Bank />);
  });
  const sections = (): string[] =>
    root!.root.findAll((node) => typeof node.type === "string" && (node.props["data-vanilla"] ?? node.props["data-section"]) !== undefined)
      .map((node) => node.props["data-vanilla"] ?? node.props["data-section"]);
  const options = (): ReactTestInstance[] => root!.root.findAllByType(VanillaComponentResolver.instance.ToolButton);

  beforeEach(() => {
    resetBindings();
    setBinding("BetterBuildingMenu", "OwnsCurrentMenu", true);
    setBinding("BetterBuildingMenu", "AssetMenuFacets", {
      groups: [{ id: "theme", label: "Theme", options: [{ id: "European", label: "European", selected: false }] }, availability],
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  it("adds availability after vanilla's own sections, and only availability", () => {
    render();

    // Theme is the rail's; the vanilla Theme here is the game's own section.
    assert.deepEqual(sections(), ["Theme", "Pack", "Availability"]);
  });

  it("draws each option as the game's tool button, with its icon and state", () => {
    render();

    assert.deepEqual(
      options().map((button) => [button.props.tooltip, button.props.src, button.props.selected, button.props.multiSelect]),
      [
        ["Locked", "lock.svg", true, true],
        ["Unlocked", "unlock.svg", false, true],
        ["Already built", "Media/Game/Icons/AlreadyBuilt.svg", false, true],
      ]
    );
  });

  it("toggles the option pressed", () => {
    render();

    act(() => options()[2].props.onSelect());

    assert.deepEqual(triggers.map((call) => [call.name, ...call.args]), [["ToggleAssetMenuFacet", "availability", "AlreadyBuilt"]]);
  });

  it("leaves vanilla's bank alone while the asset menu is not the open menu", () => {
    setBinding("BetterBuildingMenu", "OwnsCurrentMenu", false);
    render();

    assert.deepEqual(sections(), ["Theme", "Pack"]);
  });

  it("leaves vanilla's bank alone in photo mode", () => {
    setBinding("game", "activeGamePanel", { __Type: "Game.UI.InGame.PhotoModePanel" });
    render();

    assert.deepEqual(sections(), ["Theme", "Pack"]);
  });

  it("adds no empty section when availability has no options", () => {
    setBinding("BetterBuildingMenu", "AssetMenuFacets", { groups: [{ ...availability, options: [] }] });
    render();

    assert.deepEqual(sections(), ["Theme", "Pack"]);
  });

  it("follows the facets as they change", () => {
    render();
    act(() => setBinding("BetterBuildingMenu", "AssetMenuFacets", {
      groups: [{ ...availability, options: availability.options.map((option) => ({ ...option, selected: option.id === "Unlocked" })) }],
    }));

    assert.deepEqual(options().map((button) => button.props.selected), [false, true, false]);
  });
});
