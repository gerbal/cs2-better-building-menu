import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { optionClickedCommand } from "../src/domain/buildingCatalogContracts.ts";
import {
  clearBuildingLensFacetsCommand,
  facetGroupNeedsScroll,
  facetOptionMarker,
  hasScrollableFacetGroups,
  hasSelectedBuildingLensFacets,
  toggleBuildingLensFacetCommand,
} from "../src/domain/buildingCatalogFacets.ts";
import { getFilterOptionState } from "../src/domain/filterContracts.ts";

const buildingCatalogSource = readFileSync(
  new URL("../src/mods/BuildingCatalog/BuildingCatalog.tsx", import.meta.url),
  "utf8"
);
const buildingCatalogStyles = readFileSync(
  new URL("../src/mods/BuildingCatalog/buildingCatalog.module.scss", import.meta.url),
  "utf8"
);
const topBarSource = readFileSync(new URL("../src/mods/TopBar/TopBar.tsx", import.meta.url), "utf8");

describe("Building Lens filter controls", () => {
  it("dispatches the Extra Filters option through the FindIt binding", () => {
    assert.deepEqual(optionClickedCommand(90, 0, 0), {
      method: "OptionClicked",
      args: [90, 0, 0],
    });
  });

  it("keeps selected state visible while disabling disabled options", () => {
    assert.deepEqual(getFilterOptionState(true, false), {
      selected: true,
      disabled: false,
      interactive: true,
    });
    assert.deepEqual(getFilterOptionState(true, true), {
      selected: false,
      disabled: true,
      interactive: false,
    });
  });

  it("builds exact facet toggle and clear trigger payloads", () => {
    assert.deepEqual(toggleBuildingLensFacetCommand("buildingType", "School"), {
      method: "ToggleBuildingLensFacet",
      args: ["buildingType", "School"],
    });
    assert.deepEqual(clearBuildingLensFacetsCommand(), {
      method: "ClearBuildingLensFacets",
      args: [],
    });
  });

  it("treats extensions as a first-class selectable facet", () => {
    const extensionGroup = {
      id: "extension",
      label: "Extensions",
      options: [{ id: "HospitalWing01", label: "Hospital Wing 01", selected: true }],
    };

    assert.equal(hasSelectedBuildingLensFacets({ groups: [extensionGroup], hasSelection: true }), true);
    assert.equal(facetOptionMarker(extensionGroup.options[0].selected), "✓");
    assert.deepEqual(toggleBuildingLensFacetCommand(extensionGroup.id, extensionGroup.options[0].id), {
      method: "ToggleBuildingLensFacet",
      args: ["extension", "HospitalWing01"],
    });
  });

  it("does not invent an extension filter when indexed metadata is empty", () => {
    const emptyExtensionGroup = { id: "extension", label: "Extensions", options: [] };

    assert.equal(hasSelectedBuildingLensFacets({ groups: [emptyExtensionGroup], hasSelection: false }), false);
    assert.equal(hasScrollableFacetGroups([emptyExtensionGroup]), false);
  });

  it("reports selected facet options without treating available options as active", () => {
    assert.equal(
      hasSelectedBuildingLensFacets({
        groups: [
          {
            id: "buildingType",
            label: "Role",
            options: [{ id: "School", label: "School", selected: false }],
          },
          {
            id: "placement",
            label: "Placement",
            options: [{ id: "RequireRoad", label: "Require road", selected: true }],
          },
        ],
        hasSelection: false,
      }),
      true
    );
  });

  it("exposes a deterministic selected marker and scroll affordance threshold", () => {
    assert.equal(facetOptionMarker(true), "✓");
    assert.equal(facetOptionMarker(false), "○");

    const shortGroup = {
      id: "theme",
      label: "Theme",
      options: Array.from({ length: 8 }, (_, index) => ({ id: `${index}`, label: `${index}`, selected: false })),
    };
    const longGroup = {
      id: "dlc",
      label: "DLC",
      options: Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, label: `${index}`, selected: false })),
    };

    assert.equal(facetGroupNeedsScroll(shortGroup), false);
    assert.equal(facetGroupNeedsScroll(longGroup), true);
    assert.equal(hasScrollableFacetGroups([shortGroup, longGroup]), true);
    assert.equal(hasScrollableFacetGroups([shortGroup]), false);
  });
});

describe("Building Lens action affordances", () => {
  it("keeps Place and compare actions explicitly labeled in catalog rows", () => {
    assert.match(buildingCatalogSource, /className=\{styles\.placeHint\}/);
    // The row itself now opens details; Place is its own button, so the row's
    // label describes inspection and the Place label sits on the Place control.
    assert.match(buildingCatalogSource, /aria-label=\{inspectLabel\}/);
    assert.match(buildingCatalogSource, /aria-label=\{rowPlaceLabel\}/);
    assert.match(buildingCatalogSource, /title=\{rowPlaceLabel\}/);
    assert.match(buildingCatalogSource, /aria-label=\{compareLabel\}/);
    assert.match(buildingCatalogSource, /aria-label=\{comparePlaceLabel\}/);
    assert.match(buildingCatalogSource, /aria-label=\{compareRemoveLabel\}/);
  });

  it("separates inspecting a building from committing to placing it", () => {
    // The whole row used to be a Place button, and placement closes the panel,
    // so there was no way to look without committing.
    assert.match(buildingCatalogSource, /onSelect=\{\(\) => toggleExpanded\(entry\.id\)\}/);
    assert.match(buildingCatalogSource, /className=\{styles\.rowPlaceButton\}/);
    assert.match(buildingCatalogSource, /onSelect=\{\(\) => activate\(entry\)\}/);
  });

  it("renders the projected analytical metrics when a row is expanded", () => {
    assert.match(buildingCatalogSource, /getBuildingDetailMetrics\(entry\)/);
    assert.match(buildingCatalogStyles, /\.rowDetails/);
  });

  it("makes the row Place hint visible for hover and keyboard focus", () => {
    assert.match(buildingCatalogStyles, /\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:hover[^\{]*\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:focus[^\{]*\.placeHint/);
  });

  it("provides explicit labels for TopBar lens and section icon actions", () => {
    assert.match(topBarSource, /styles\.accessibleLabel/);
    assert.match(topBarSource, /Enable building lens/);
    assert.match(topBarSource, /\{element\.toolTip\}/);
  });

  it("labels the glyph-only catalog paging controls", () => {
    // The labels are localized now rather than hardcoded English, so assert
    // that each glyph button carries a label binding instead of matching a
    // literal string that would break on translation.
    for (const label of ["firstPageLabel", "previousPageLabel", "nextPageLabel", "lastPageLabel"]) {
      assert.match(buildingCatalogSource, new RegExp(`aria-label=\\{${label}\\}`));
      assert.match(buildingCatalogSource, new RegExp(`title=\\{${label}\\}`));
    }
  });

  it("offers first and last page jumps for a catalog dozens of pages deep", () => {
    // Prev/next alone put the far end of a 43-page catalog ~42 clicks away.
    assert.match(buildingCatalogSource, /onSelect=\{\(\) => setPage\(0\)\}/);
    assert.match(buildingCatalogSource, /onSelect=\{\(\) => setPage\(lastPageOffset\)\}/);
  });
});

describe("Building Lens chrome budget", () => {
  it("carries identity and sort in one toolbar rather than stacked bands", () => {
    // Measured live: chrome took 334px of a 625px panel and left the rows 159px
    // (25%). The title band and the sort band were two full-width rows carrying
    // one short line each.
    assert.match(buildingCatalogSource, /className=\{styles\.toolbar\}/);
    assert.doesNotMatch(buildingCatalogSource, /className=\{styles\.heading\}/);
    assert.doesNotMatch(buildingCatalogSource, /className=\{styles\.sortBar\}/);
  });

  it("spends a line on search context only while a search is active", () => {
    // "Buildings from the FindIt index" is a static caption that cost a whole
    // row on every frame; the search variant is the only informative case.
    assert.match(buildingCatalogSource, /searchContext/);
  });

  it("keeps the sort options as a wrapped row under the toolbar", () => {
    assert.match(buildingCatalogSource, /data-sort-options="expanded"/);
  });
});
