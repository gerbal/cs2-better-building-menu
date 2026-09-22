import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { act, create, type ReactTestInstance } from "react-test-renderer";
import "../harness/render";
import { getModule } from "../harness/stubs/cs2-modding";
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
