import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import type { OpenPopover } from "../../src/domain/topRow";
import { ControlPopover } from "../../src/mods/ControlPopover/ControlPopover";

type Press = (event: { target: unknown }) => void;

const set = (name: string, value: unknown) => setBinding("BetterBuildingMenu", name, value);
const globals = globalThis as unknown as Record<string, unknown>;
// The document's capture listeners for presses, so a test can press where it likes.
let listeners: Press[] = [];
let root: ReactTestRenderer | undefined;
let closed = 0;

const mount = (open: OpenPopover | null, limit = 706) => act(() => {
  root = create(<ControlPopover open={open} limit={limit} bottom={210.25} onClose={() => { closed += 1; }} />);
});
const popover = () => root!.root.find((node) => node.props["data-bbm-popover"] === "true");
const rows = () => root!.root.findAll((node) => typeof node.props["aria-label"] === "string" && typeof node.props.onSelect === "function");
const pick = (label: string) => act(() => rows().find((node) => node.props["aria-label"] === label)!.props.onSelect());
const sent = (name: string) => triggers.filter((call) => call.name === name).map((call) => call.args);
const pressAt = (target: unknown) => act(() => [...listeners].forEach((listener) => listener({ target })));
const marked = (attribute: string) => ({ getAttribute: (name: string) => (name === attribute ? "true" : null), parentElement: null });

describe("a control's popover", () => {
  let saved: unknown;

  beforeEach(() => {
    resetBindings();
    closed = 0;
    listeners = [];
    saved = globals.document;
    globals.document = {
      addEventListener: (type: string, listener: Press) => {
        if (type === "mousedown") listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: Press) => {
        listeners = listeners.filter((other) => other !== listener);
      },
    };
    set("BuildingCatalogSortColumn", "Default");
    set("BuildingCatalogSortDescending", false);
    set("BuildingCatalog", catalogPage([entry(1)], { reorderableSortColumns: ["Default", "Name", "ConstructionCost"] }));
    set("AssetMenuGroupDimensions", ["menuCategory", "none"]);
    set("BuildingCatalogGroupBy", "menuCategory");
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    globals.document = saved;
  });

  it("opens above the box at its control's left, pulled in to end at the limit", () => {
    mount({ kind: "sort", left: 600 });

    // 706 less its 240: the box's right edge.
    assert.deepEqual(popover().props.style, { left: "466rem", bottom: "210.25rem" });
  });

  it("ends at the limit when its control could not be measured", () => {
    mount({ kind: "sort", left: null }, 1104);

    assert.equal(popover().props.style.left, "864rem");
  });

  it("lists Default and the sorts that can move the menu's rows, the current one lit, and closes on a pick", () => {
    mount({ kind: "sort", left: 0 });

    assert.deepEqual(rows().map((node) => node.props["aria-label"]), ["Default", "Name", "Cost"]);
    assert.equal(rows().find((node) => node.props["aria-current"] === "true")!.props["aria-label"], "Default");
    pick("Cost");

    assert.deepEqual(sent("SetBuildingCatalogSortColumn"), [["ConstructionCost"]]);
    assert.equal(closed, 1);
  });

  it("flips the lit sort's direction when it is picked again", () => {
    set("BuildingCatalogSortColumn", "ConstructionCost");
    mount({ kind: "sort", left: 0 });
    pick("Cost");

    assert.deepEqual(sent("SetBuildingCatalogSortDescending"), [[true]]);
  });

  it("lists the groupings the menu offers, its own lit, and closes on a pick", () => {
    mount({ kind: "group", left: 0 });

    assert.deepEqual(rows().map((node) => node.props["aria-label"]), ["By tab", "No groups"]);
    pick("No groups");

    assert.deepEqual(sent("SetBuildingCatalogGroupBy"), [["none"]]);
    assert.equal(closed, 1);
  });

  it("closes on a press outside it and the controls, never on one inside either", () => {
    mount({ kind: "sort", left: 0 });

    pressAt({ getAttribute: () => null, parentElement: marked("data-bbm-popover") });
    pressAt(marked("data-bbm-controls"));
    assert.equal(closed, 0);

    pressAt({ getAttribute: () => null, parentElement: null });
    assert.equal(closed, 1);
  });
});
