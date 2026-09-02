import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBuildingCatalogLabels } from "../src/domain/buildingCatalog.ts";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog.ts";

function identity(
  category: string,
  subCategory: string,
  categoryLabel?: string,
  subCategoryLabel?: string,
): Pick<BuildingCatalogEntry, "category" | "subCategory" | "categoryLabel" | "subCategoryLabel"> {
  return { category, subCategory, categoryLabel, subCategoryLabel };
}

describe("Building Lens catalog labels", () => {
  it("prefers player-facing labels over raw enum identities", () => {
    assert.equal(
      formatBuildingCatalogLabels(
        identity(
          "ServiceBuildings",
          "ServiceBuildings_EducationResearch",
          "Service Buildings",
          "Education & Research",
        ),
      ),
      "Service Buildings · Education & Research",
    );
  });

  it("falls back to raw values for legacy catalog payloads", () => {
    assert.equal(
      formatBuildingCatalogLabels(identity("CustomCategory", "CustomCategory_SubType")),
      "CustomCategory · CustomCategory_SubType",
    );
  });
});
