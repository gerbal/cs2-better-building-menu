import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { act, create, type ReactTestInstance } from "react-test-renderer";
import "../harness/render";
import { getModule } from "../harness/stubs/cs2-modding";
import { Dropdown, DropdownItem, DropdownToggle, Tooltip } from "../harness/stubs/cs2-ui";
import { FilterRail } from "../../src/mods/FilterRail/FilterRail";
import { RAIL_SEARCH_THRESHOLD, type RailFacetState } from "../../src/domain/filterRail";

// The game's TextInput hands onChange the DOM event, not the string. The stub is
// the element getModule gives FilterRail, found in the tree and driven the way
// the game drives it.
const TextInput = getModule("game-ui/common/input/text/text-input.tsx", "TextInput") as () => JSX.Element;

const many = RAIL_SEARCH_THRESHOLD + 5;
const facets: RailFacetState = {
  groups: [{
    id: "extension",
    label: "Extensions",
    options: [
      { id: "wing", label: "Extension Wing", selected: false },
      ...Array.from({ length: many - 1 }, (_, i) => ({ id: `other${i}`, label: `Other ${i}`, selected: false })),
    ],
  }],
};

const labels = (root: ReactTestInstance): string[] =>
  root.findAll((node) => typeof node.type === "string" && node.children.length === 1 && typeof node.children[0] === "string")
    .map((node) => node.children[0] as string);

describe("the filter rail's option search", () => {
  it("narrows the options to what was typed", () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<FilterRail facets={facets} metricsActive={0} onToggleOption={() => undefined} renderMetrics={() => <div />} />);
    });
    assert.ok(labels(tree.root).includes("Other 3"), "every option is listed before a search");

    const input = tree.root.findByType(TextInput);
    act(() => input.props.onChange({ target: { value: "wing" } }));

    const shown = labels(tree.root);
    assert.ok(shown.includes("Extension Wing"));
    assert.ok(!shown.includes("Other 3"), "the search narrows the list");
  });
});

describe("the filter rail", () => {
  const option = (id: string, selected = false) => ({ id, label: id, selected });
  const state: RailFacetState = {
    groups: [
      { id: "theme", label: "Theme", options: [option("European", true), option("American")] },
      // Every option ticked narrows nothing, and the backend says so.
      { id: "dlc", label: "Content", narrowing: false, options: [option("Base", true)] },
      { id: "zone", label: "Zone", options: [] },
      // The bank draws this one, in the game's tool-options panel.
      { id: "availability", label: "Availability", options: [option("Locked", true)] },
    ],
  };

  let tree: ReturnType<typeof create> | undefined;
  let toggled: Array<[string, string]> = [];

  const render = (metricsActive = 0) => act(() => {
    tree = create(
      <FilterRail
        facets={state}
        metricsActive={metricsActive}
        onToggleOption={(group, id) => toggled.push([group, id])}
        renderMetrics={() => <div data-metrics="true" />}
      />
    );
  });
  const toggles = (): ReactTestInstance[] => tree!.root.findAllByType(DropdownToggle);
  const dropdown = (label: string): ReactTestInstance =>
    tree!.root.findAllByType(Dropdown).find((node) => node.findAllByType(DropdownToggle)[0].props["aria-label"] === label)!;
  // The stub draws a dropdown's content inline, open or not.
  const items = (label: string): ReactTestInstance[] => dropdown(label).findAllByType(DropdownItem);

  beforeEach(() => {
    toggled = [];
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  it("draws one icon per dimension with options, metrics last, and leaves the bank's dimension to the bank", () => {
    render();

    assert.deepEqual(toggles().map((node) => node.props["aria-label"]), ["Theme", "Content", "Metric filters"]);
  });

  it("counts what narrows, and names what survives in the tooltip", () => {
    render();
    const tooltips = tree!.root.findAllByType(Tooltip).map((node) => node.props.tooltip);

    assert.deepEqual(tooltips, ["Theme: European", "Content", "Metric filters"]);
    assert.deepEqual(toggles().map((node) => node.props.className), ["icon iconActive", "icon", "icon"]);
    assert.deepEqual(toggles().map((node) => node.findAll((child) => child.props.className === "badge").map((badge) => badge.children[0])), [["1"], [], []]);
  });

  it("counts the metric ranges the drawer reports", () => {
    render(2);

    const metrics = toggles().at(-1)!;
    assert.equal(metrics.props.className, "icon iconActive");
    assert.deepEqual(metrics.findAll((child) => child.props.className === "badge").map((badge) => badge.children[0]), ["2"]);
  });

  it("toggles an option whichever way the game's item reports the click", () => {
    render();
    const [european, american] = items("Theme");

    // The game's item calls onToggleSelected on a ticked option and onChange on
    // an unticked one; each must reach the toggle.
    act(() => european.props.onToggleSelected());
    act(() => american.props.onChange());

    assert.deepEqual(toggled, [["theme", "European"], ["theme", "American"]]);
    assert.deepEqual([european.props.selected, american.props.selected], [true, false]);
    assert.ok(items("Theme").every((item) => item.props.closeOnSelect === false), "the menu stays open to tick several");
  });

  it("draws the metric drawer, not an option list, under the metrics icon", () => {
    render();

    const content = dropdown("Metric filters");
    assert.equal(content.findAll((node) => node.props["data-metrics"] === "true").length, 1);
    assert.equal(content.findAllByType(DropdownItem).length, 0);
  });

  it("clears the search when a dimension's menu is opened again", () => {
    act(() => {
      tree = create(<FilterRail facets={facets} metricsActive={0} onToggleOption={() => undefined} renderMetrics={() => <div />} />);
    });
    act(() => tree!.root.findByType(TextInput).props.onChange({ target: { value: "wing" } }));
    assert.ok(!labels(tree!.root).includes("Other 3"));

    act(() => tree!.root.findAllByType(Dropdown)[0].props.onToggle(true));

    assert.equal(tree!.root.findByType(TextInput).props.value, "");
    assert.ok(labels(tree!.root).includes("Other 3"));
  });
});
