import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderHtml, entry } from "../harness/render";
import { resetBindings } from "../harness/stubs/cs2-api";
import { GroupedResults } from "../../src/mods/GroupedResults/GroupedResults";

const render = (paths: string[][], names: (string | undefined)[] = []) =>
  renderHtml(
    <GroupedResults
      entries={paths.map((groupPath, i) =>
        entry(i + 1, names[i] === undefined ? { groupPath } : { groupPath, name: names[i]! }))}
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

    const parent = found.find((g) => g.heading === "Cul-De-Sacs");
    assert.ok(parent, "the two-child group");
    assert.match(parent!.classes, /\bgroupBand\b/, "a group with two sub-groups is banded");
    // One child means one hidden heading — the group reads as a leaf and
    // flows like one. Measured live, banding these too gave a one-tile
    // ROAD SERVICES a whole 84px row to itself in a search.
    const lone = found.find((g) => g.heading === "Small Roads");
    assert.ok(lone);
    assert.doesNotMatch(lone!.classes, /\bgroupBand\b/, "a group with one sub-group flows");
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

  it("keeps every branch's heading, even a one-asset branch that restates its tile", () => {
    // A collapse rule once removed these as redundant. It merged Healthcare's
    // Hospital, Disease Control Center and Health Research Institute into one
    // unlabeled block: the tiles draw as "Disease Contro…Center" and "Health
    // Resear…titute", so the heading was the only legible full name and
    // dropping it as a duplicate dropped the readable copy.
    const html = render(
      [
        ["Healthcare", "Hospital"],
        ["Healthcare", "Disease Control Center"],
        ["Healthcare", "Health Research Institute"],
      ],
      ["Hospital", "Disease Control Center", "Health Research Institute"]
    );
    const found = groups(html);

    for (const name of ["Hospital", "Disease Control Center", "Health Research Institute"]) {
      assert.ok(found.some((g) => g.heading === name), `${name} keeps its heading`);
    }
  });

  it("reserves no heading row for a lone child whose heading is not drawn", () => {
    // shouldShowHeading already hid the heading of an only child; the 17rem
    // it reserved for one stayed, as 12px of nothing under every category.
    const html = render([
      ["Road Services", "Milestone 3"],
      ["Paths", "From the start"],
    ]);
    const children = groups(html).filter((g) => g.heading === null);

    assert.equal(children.length, 2);
    for (const child of children) {
      assert.match(child.classes, /\bgroupUnlabeled\b/);
    }
  });
});
