import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderHtml } from "../harness/render";
import { FilterRail } from "../../src/mods/FilterRail/FilterRail";
import type { RailFacetState } from "../../src/domain/filterRail";

const option = (id: string) => ({ id, label: id, selected: false });

describe("the filter rail's icons", () => {
  it("draws one for every dimension the backend sends, Content included", () => {
    // Content replaced the separate DLC and pack facets, and for a while the
    // rail had icons for those and none for it: an empty button in the row.
    const ids = ["buildingType", "provenance", "content", "theme", "placement"];
    const facets: RailFacetState = {
      groups: ids.map((id) => ({
        id,
        label: id,
        options: [option("a"), option("b")],
      })),
    };

    const html = renderHtml(<FilterRail facets={facets} metricsActive={0} onToggleOption={() => undefined} renderMetrics={() => <div />} />);
    const sources = [...html.matchAll(/<img src="([^"]*)"/g)].map(([, src]) => src);

    assert.equal(sources.length, ids.length + 1, "every facet and the metrics");
    assert.deepEqual(sources.filter((src) => src === ""), [], "a dimension drawn with no icon");
  });
});
