import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry } from "../harness/render";
import { resetBindings } from "../harness/stubs/cs2-api";
import { GroupedResults } from "../../src/mods/GroupedResults/GroupedResults";

const render = (paths: string[][]) =>
  renderHtml(
    <GroupedResults
      entries={paths.map((groupPath, i) => entry(i + 1, { groupPath }))}
      viewMode="grid"
      searchText=""
      onPlace={() => undefined}
    />
  );

// The opening tag of each group, in document order, with the classes it
// carries; the heading text that follows it up to the next group.
const groups = (html: string): { classes: string; heading: string | null }[] =>
  [...html.matchAll(/<div class="(group[^"]*)" data-group-depth="\d+">(.*?)(?=<div class="group[ "]|$)/g)].map((m) => {
    const heading = m[2].match(/class="groupLabel" title="([^"]*)"/);
    return { classes: m[1], heading: heading ? heading[1] : null };
  });

describe("grouped results", () => {
  beforeEach(() => resetBindings());

  it("gives a group with sub-groups the whole row, and a leaf group its share of one", () => {
    // Searching `tre` in Roads: a two-level CUL-DE-SACS beside a one-level
    // SMALL ROADS flowed onto one line, so the parent heading, its children's
    // headings and the neighbour's heading shared two rows of 11px.
    const html = render([
      ["Small Roads", "Small Roads"],
      ["Small Roads", "Small Roads"],
      ["Cul-De-Sacs", "Cul De Sacs"],
      ["Cul-De-Sacs", "Roundabouts"],
    ]);
    const found = groups(html);

    const parents = found.filter((g) => g.heading === "Small Roads" || g.heading === "Cul-De-Sacs");
    assert.equal(parents.length, 2, "two top-level groups");
    for (const parent of parents) {
      assert.match(parent.classes, /\bgroupBand\b/, `${parent.heading} spans the row`);
    }
    const leaves = found.filter((g) => g.heading === "Cul De Sacs" || g.heading === "Roundabouts");
    assert.equal(leaves.length, 2);
    for (const leaf of leaves) {
      assert.doesNotMatch(leaf.classes, /\bgroupBand\b/, `${leaf.heading} flows`);
    }
  });

  it("draws no heading for a nested group named like its parent", () => {
    // Roads grouped by category: the dev tree names its base branch after the
    // category, so MEDIUM ROADS carried a "Medium Roads" sub-heading with a
    // second count under the first.
    const html = render([
      ["Medium Roads", "Medium Roads"],
      ["Medium Roads", "Medium Roads"],
      ["Medium Roads", "Bridges"],
      ["Large Roads", "Large Roads"],
      ["Large Roads", "Highways"],
    ]);
    const found = groups(html);

    const unlabeled = found.filter((g) => /\bgroupUnlabeled\b/.test(g.classes));
    assert.equal(unlabeled.length, 2, "one same-named child under each parent");
    for (const g of unlabeled) {
      assert.equal(g.heading, null, "no heading of its own");
    }
    assert.ok(found.some((g) => g.heading === "Bridges"), "a differently named sibling keeps its heading");
    assert.ok(found.some((g) => g.heading === "Highways"));
    assert.equal(found.filter((g) => g.heading === "Medium Roads").length, 1, "the name appears once");
  });
});
