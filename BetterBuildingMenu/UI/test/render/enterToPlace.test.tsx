import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { resetLensView, setLensView } from "../../src/domain/lensViewStore";
import { BuildingCatalogComponent } from "../../src/mods/BuildingCatalog/BuildingCatalog";

// Mounted, not rendered to markup: the Enter listener is an effect. Node has no
// document, so the few globals the catalog's effects reach for are faked here.
type Listener = (event: { key: string; keyCode?: number }) => void;
const globals = globalThis as unknown as Record<string, unknown>;
let keydown: Listener[] = [];

function installDocument(): void {
  keydown = [];
  globals.document = {
    addEventListener: (type: string, listener: Listener) => {
      if (type === "keydown") keydown.push(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      if (type === "keydown") keydown = keydown.filter((other) => other !== listener);
    },
  };
  globals.requestAnimationFrame = () => 0;
  globals.cancelAnimationFrame = () => undefined;
}

const press = (key: string, keyCode?: number) => act(() => {
  for (const listener of [...keydown]) listener({ key, keyCode });
});
const armed = () => triggers.filter((call) => call.name === "SetCurrentPrefab").map((call) => call.args[0]);

// Two groups, the weaker match first: grouping orders the page by group before
// relevance, which is exactly when the first row is not the one to arm.
const groupedSearch = (bestMatchId: number | null) => {
  setBinding("BetterBuildingMenu", "BuildingCatalog", catalogPage(
    [
      entry(2, { name: "Old Clinic", groupPath: ["Buildings"] }),
      entry(1, { name: "Clinic", groupPath: ["ServiceBuildings"] }),
    ],
    { bestMatchId }
  ));
  setBinding("BetterBuildingMenu", "BuildingCatalogGroupBy", "category");
};

describe("Enter in the catalog", () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    resetBindings();
    resetLensView();
    installDocument();
    setBinding("BetterBuildingMenu", "PanelWidth", 700);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
  });

  const mount = () => act(() => {
    root = create(<BuildingCatalogComponent />);
  });

  for (const mode of ["grid", "list", "cards", "table"]) {
    it(`arms the best match exactly once in ${mode} mode`, () => {
      setLensView({ viewMode: mode });
      groupedSearch(1);
      setBinding("BetterBuildingMenu", "CurrentSearch", "clinic");
      mount();

      press("Enter");

      assert.deepEqual(armed(), [1]);
    });
  }

  it("arms on Enter reported by keyCode alone", () => {
    // Cohtml leaves `key` empty for some keys and fills `keyCode`.
    groupedSearch(1);
    setBinding("BetterBuildingMenu", "CurrentSearch", "clinic");
    mount();

    press("", 13);

    assert.deepEqual(armed(), [1]);
  });

  it("arms nothing without a search", () => {
    groupedSearch(null);
    setBinding("BetterBuildingMenu", "CurrentSearch", "");
    mount();

    press("Enter");

    assert.deepEqual(armed(), []);
  });

  it("ignores other keys, and lets go of the document when it unmounts", () => {
    groupedSearch(1);
    setBinding("BetterBuildingMenu", "CurrentSearch", "clinic");
    mount();

    press("a");
    assert.deepEqual(armed(), []);

    act(() => root?.unmount());
    root = undefined;
    assert.equal(keydown.length, 0);
  });
});
