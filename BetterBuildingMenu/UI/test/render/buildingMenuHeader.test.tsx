import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderHtml, count } from "../harness/render";
import { resetBindings, setBinding } from "../harness/stubs/cs2-api";
import { BuildingMenuHeader } from "../../src/mods/BuildingMenu/BuildingMenuHeader";

describe("the menu header, mounted", () => {
  it("mounts without a warning from React", () => {
    // The game's TextInput takes the ref the header hands it; the test stub must too, or every
    // mount prints a warning that would hide a real one.
    const warnings: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };

    try {
      // Two acts: one that creates and unmounts batches both, and the header never draws.
      let root: ReactTestRenderer | undefined;
      act(() => {
        root = create(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />);
      });
      assert.equal(root!.root.findAllByType("input").length, 1, "the header drew its search field");
      act(() => root!.unmount());
    } finally {
      console.error = original;
    }

    assert.deepEqual(warnings.filter((warning) => /cannot be given refs/.test(warning)), []);
  });
});

describe("the menu header", () => {
  beforeEach(() => {
    resetBindings();
    setBinding("BetterBuildingMenu", "CurrentSearch", "road");
    setBinding("BetterBuildingMenu", "AssetMenu", "Roads");
  });

  it("provides explicit labels for its icon actions", () => {
    const html = renderHtml(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />);

    assert.match(html, /aria-label="Clear search"/);
    assert.match(html, /aria-label="Close"/);
  });

  it("hides every decorative image from assistive readers", () => {
    const html = renderHtml(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />);
    const images = count(html, /<img /);

    assert.ok(images > 0, "expected the header to draw its icons");
    assert.equal(count(html, /<img [^>]*alt="" aria-hidden="true"/), images);
  });

  it("draws no close control when the game hands it no close", () => {
    // The asset menu must still render if the game ever mounts it without one.
    const html = renderHtml(<BuildingMenuHeader small={false} large={false} />);

    assert.doesNotMatch(html, /aria-label="Close"/);
  });

  it("draws no tabs: they are the tab row's, under the list", () => {
    setBinding("BetterBuildingMenu", "AssetMenuCategories", [
      { id: "SmallRoads", name: "SmallRoads", icon: "Media/Game/Icons/SmallRoads.svg", priority: 0 },
      { id: "Highways", name: "Highways", icon: "Media/Game/Icons/Highways.svg", priority: 1 },
    ]);
    setBinding("BetterBuildingMenu", "AssetMenuCategoryCounts", [{ id: "SmallRoads", count: 3 }, { id: "Highways", count: 4 }]);

    assert.doesNotMatch(renderHtml(<BuildingMenuHeader small={false} large={false} onClose={() => {}} />), /SmallRoads|Highways/);
  });
});
