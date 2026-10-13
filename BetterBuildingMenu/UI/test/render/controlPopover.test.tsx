import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { catalogPage, entry } from "../harness/render";
import { resetBindings, setBinding, triggers } from "../harness/stubs/cs2-api";
import { Dropdown, DropdownItem } from "../harness/stubs/cs2-ui";
import { resetAssetMenuView } from "../../src/domain/assetMenuViewStore";
import { ASSET_MENU_SORT_OPTIONS } from "../../src/domain/assetMenuSortPresentation";
import { SORT_FIRST_DESCENDING } from "../../src/domain/sharedContracts.generated";
import type { OpenPopover, PopoverAnchor } from "../../src/domain/topRow";
import { ControlPopover } from "../../src/mods/ControlPopover/ControlPopover";
import { PickerRow } from "../../src/mods/Pickers/PickerRow";

type Press = (event: { target: unknown }) => void;

const set = (name: string, value: unknown) => setBinding("BetterBuildingMenu", name, value);
const globals = globalThis as unknown as Record<string, unknown>;
// The document's capture listeners for presses, so a test can press where it likes.
let listeners: Press[] = [];
// Each mousedown listener's capture flag, as it was registered.
let captures: unknown[] = [];
let root: ReactTestRenderer | undefined;
let closed = 0;

const mount = (open: OpenPopover | null, limit = 706, anchor: PopoverAnchor = { bottom: 210.25 }) => act(() => {
  root = create(<ControlPopover open={open} limit={limit} anchor={anchor} onClose={() => { closed += 1; }} />);
});
const popover = () => root!.root.find((node) => node.props["data-bbm-popover"] === "true");
const rows = () => root!.root.findAll((node) => typeof node.props["aria-label"] === "string" && typeof node.props.onSelect === "function");
const pick = (label: string) => act(() => rows().find((node) => node.props["aria-label"] === label)!.props.onSelect());
const sent = (name: string) => triggers.filter((call) => call.name === name).map((call) => call.args);
const pressAt = (target: unknown) => act(() => [...listeners].forEach((listener) => listener({ target })));
const marked = (attribute: string) => ({ getAttribute: (name: string) => (name === attribute ? "true" : null), parentElement: null });
const outside = { getAttribute: () => null, parentElement: null };
const filters = () => set("AssetMenuFacets", {
  groups: [{ id: "theme", label: "Theme", options: [{ id: "European", label: "European", selected: true }, { id: "American", label: "American", selected: false }] }],
  hasSelection: true,
});
const classes = (node: { props: { className?: unknown } }) => String(node.props.className ?? "").split(" ");

describe("a control's popover", () => {
  let saved: unknown;

  beforeEach(() => {
    resetBindings();
    resetAssetMenuView();
    closed = 0;
    listeners = [];
    captures = [];
    saved = globals.document;
    globals.document = {
      addEventListener: (type: string, listener: Press, capture?: unknown) => {
        if (type !== "mousedown") return;
        listeners.push(listener);
        captures.push(capture);
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

  it("hangs from its top under the top row when anchored there, opening down over the body", () => {
    mount({ kind: "sort", left: 600 }, 706, { top: 34 });

    assert.deepEqual(popover().props.style, { left: "466rem", top: "34rem" });
  });

  it("opens Width, every menu downward beside the VIEW list when the popover hangs from its top, and upward above the box", () => {
    const widthList = () => root!.root.find((node) => node.type === "div" && classes(node).includes("widthList"));

    mount({ kind: "view", left: 0 }, 706, { top: 34 });
    pick("Width · 1");
    assert.ok(classes(widthList()).includes("down"));
    act(() => root!.unmount());

    mount({ kind: "view", left: 0 });
    pick("Width · 1");
    assert.equal(classes(widthList()).includes("down"), false);
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

  it("flips the lit sort's direction when it is picked again, and keeps its column", () => {
    set("BuildingCatalogSortColumn", "ConstructionCost");
    mount({ kind: "sort", left: 0 });
    pick("Cost");

    assert.deepEqual(sent("SetBuildingCatalogSortColumn"), [["ConstructionCost"]]);
    assert.deepEqual(sent("SetBuildingCatalogSortDescending"), [[true]]);
  });

  it("sorts a newly picked column best first: the counts most first, the rest least first", () => {
    const columns = ["ConstructionCost", ...SORT_FIRST_DESCENDING];

    for (const column of columns) {
      resetBindings();
      set("BuildingCatalogSortColumn", "Default");
      set("BuildingCatalogSortDescending", false);
      set("BuildingCatalog", catalogPage([entry(1)], { reorderableSortColumns: ["Default", ...columns] }));
      mount({ kind: "sort", left: 0 });
      pick(ASSET_MENU_SORT_OPTIONS.find((option) => option.key === column)!.label);

      assert.deepEqual(sent("SetBuildingCatalogSortColumn"), [[column]], column);
      assert.deepEqual(sent("SetBuildingCatalogSortDescending"), [[(SORT_FIRST_DESCENDING as readonly string[]).includes(column)]], column);
      act(() => root!.unmount());
      root = undefined;
    }
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

  it("listens for a press on the document's mousedown in the capture phase, so a list under it cannot swallow it", () => {
    mount({ kind: "sort", left: 0 });

    assert.deepEqual(captures, [true]);
  });

  it("draws every row of every list inside a list, whose sheet styles the rows", () => {
    set("ControlPaneShown", true);
    for (const kind of ["sort", "group", "view"] as const) {
      mount({ kind, left: 0 });
      if (kind === "view") pick("Width · 1");
      const pickerRows = root!.root.findAllByType(PickerRow);

      assert.ok(pickerRows.length > 0, kind);
      for (const row of pickerRows) {
        let node = row.parent;
        while (node && !(node.type === "div" && classes(node).includes("list"))) node = node.parent;
        assert.ok(node, `${kind}: "${row.props.label}" is outside a list`);
      }
      act(() => root!.unmount());
      root = undefined;
    }
  });

  it("holds the rail, a chip for each filter on, and stays open on a pick", () => {
    filters();
    set("BuildingCatalogMetricRanges", null);
    mount({ kind: "filter", left: 0 });

    assert.equal(popover().findAll((node) => node.type === "div" && node.props.className === "rail").length, 1);
    assert.equal(rows().filter((node) => node.props["aria-label"] === "Remove European").length, 1);
    // On the popover's own dark surface, in its light ink.
    assert.deepEqual(popover().findAll((node) => node.type === "div" && classes(node).includes("chips")).map(classes), [["chips", "underRail"]]);
    act(() => popover().findAllByType(DropdownItem).find((item) => item.props.value === "American")!.props.onChange());

    assert.deepEqual(sent("ToggleAssetMenuFacet"), [["theme", "American"]]);
    assert.equal(closed, 0);
  });

  it("keeps FILTER open while one of the game's dropdowns it opened is open", () => {
    filters();
    set("BuildingCatalogMetricRanges", null);
    mount({ kind: "filter", left: 0 });
    const theme = () => popover().findAllByType(Dropdown)[0];

    act(() => theme().props.onToggle(true));
    // The game draws the dropdown's menu outside the popover, so a pick in it is a press outside.
    pressAt(outside);
    assert.equal(closed, 0);

    act(() => theme().props.onToggle(false));
    pressAt(outside);
    assert.equal(closed, 1);
  });

  it("lists the four views, the drawn one lit, then Width and More options, and closes on a view", () => {
    mount({ kind: "view", left: 0 });

    assert.deepEqual(rows().map((node) => node.props["aria-label"]), ["Cards", "List", "Grid", "Table", "Width · 1", "More options…"]);
    assert.equal(rows().find((node) => node.props["aria-current"] === "true")!.props["aria-label"], "Cards");
    pick("List");

    assert.deepEqual(sent("SetAssetMenuViewMode"), [["list"]]);
    assert.equal(closed, 1);
  });

  it("opens Width, every menu beside the list and keeps both open on a step; More options asks for the mod's page and closes", () => {
    set("ControlPaneShown", true);
    set("AssetMenuWidthStep", 5);
    mount({ kind: "view", left: 0 });
    pick("Width · 5");

    const widthList = () => root!.root.findAll((node) => node.type === "div" && classes(node).includes("widthList"));
    const steps = widthList()[0].findAll((node) => typeof node.props.onSelect === "function" && typeof node.props["aria-label"] === "string");
    const classed = (name: string) => steps.filter((node) => classes(node).includes(name)).map((node) => node.props["aria-label"]);

    assert.equal(widthList()[0].findAll((node) => node.type === "div" && node.props.className === "header")[0].children[0], "Width, every menu");
    assert.deepEqual(steps.map((node) => node.props["aria-label"]), ["1", "2", "3", "4", "5"]);
    // Beside the pane on 16:9 only the first three fit; the stored 5 stays lit among the dimmed.
    assert.deepEqual(classed("dim"), ["4", "5"]);
    assert.deepEqual(classed("lit"), ["5"]);
    const notes = widthList()[0].findAllByType(PickerRow).map((row) => [row.props.label, row.props.note]);
    assert.deepEqual(notes, [["1", "default"], ["2", undefined], ["3", undefined], ["4", "covers the chirper"], ["5", "covers the chirper"]]);
    act(() => steps[2].props.onSelect());

    assert.deepEqual(sent("SetAssetMenuWidthStep"), [[3]]);
    assert.equal(closed, 0);
    assert.equal(widthList().length, 1, "both lists stay open");

    pick("More options…");
    assert.deepEqual(sent("OpenModOptions"), [[]]);
    assert.equal(closed, 1);
  });
});
