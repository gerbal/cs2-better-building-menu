using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System.Linq;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Which ids each descriptor table answers to, and what each falls back to: the metrics, the
	/// facets, the sort columns and the group dimensions all look their rows up the same way.
	/// </summary>
	public sealed class DescriptorTableLookupTests
	{
		[Theory]
		[InlineData("cost", "cost")]
		[InlineData("COST", "cost")]
		[InlineData(" lotWidth ", "lotWidth")]
		[InlineData("\tLOTDEPTH\n", "lotDepth")]
		[InlineData("ConstructionCost", null)]
		[InlineData("lot Width", null)]
		[InlineData("", null)]
		[InlineData("   ", null)]
		[InlineData(null, null)]
		public void AMetricAnswersToItsIdInAnyCaseAndPadding(string? id, string? expected)
		{
			Assert.Equal(expected, BuildingCatalogMetrics.TryFind(id, out var metric) ? metric.Id : null);
		}

		[Theory]
		[InlineData("theme", FacetIds.Theme)]
		[InlineData("BUILDINGTYPE", FacetIds.BuildingType)]
		[InlineData(" placement ", FacetIds.Placement)]
		[InlineData("dlc", FacetIds.Content)]
		[InlineData(" DLC ", FacetIds.Content)]
		[InlineData("ZoneType", "zone")]
		[InlineData("zone", "zone")]
		[InlineData("zone type", null)]
		[InlineData("buildingTypes", null)]
		[InlineData("", null)]
		[InlineData(null, null)]
		public void AFacetAnswersToItsIdOrAliasInAnyCaseAndPadding(string? id, string? expected)
		{
			Assert.Equal(expected, BuildingCatalogFacetFields.TryFind(id, out var facet) ? facet.Id : null);
		}

		[Theory]
		[InlineData("Default", "Default")]
		[InlineData("upkeep", "Upkeep")]
		[InlineData("CONSTRUCTIONCOST", "ConstructionCost")]
		[InlineData("Cost", "ConstructionCost")]
		[InlineData("cost", "ConstructionCost")]
		[InlineData("lotdepth", "LotDepth")]
		// The Kelvin sign lowers to a plain k on the test runtime; the game's casing tables may differ.
		[InlineData("HasParKing", "HasParking")]
		// Unlike the other tables, padding is not trimmed: a padded id names no column.
		[InlineData(" Cost ", "Name")]
		[InlineData("Upkeep ", "Name")]
		[InlineData("Level", "Name")]
		[InlineData("", "Name")]
		[InlineData(null, "Name")]
		public void ASortColumnAnswersToItsIdOrAliasInAnyCaseAndOtherwiseSortsByName(string? id, string expected)
		{
			Assert.Equal(expected, BuildingCatalogSortColumns.Find(id).Id);
		}

		[Theory]
		[InlineData("theme", "theme", true)]
		[InlineData(" MENUCATEGORY ", "menuCategory", true)]
		[InlineData("schooltier", "schoolTier", true)]
		[InlineData("none", "none", false)]
		[InlineData(" None ", "none", false)]
		[InlineData("", "none", false)]
		[InlineData("   ", "none", false)]
		[InlineData(null, "none", false)]
		// Grouped, but under one empty key: the order is left to the sort.
		[InlineData("assetPack", "", true)]
		[InlineData("school tier", "", true)]
		public void AGroupDimensionAnswersToItsIdInAnyCaseAndPaddingWithASentinelForTheRest(string? id, string expected, bool grouped)
		{
			var dimension = BuildingCatalogGrouping.Find(id);

			Assert.Equal(expected, dimension.Id);
			Assert.Equal(grouped, dimension.IsGrouped);
		}

		[Theory]
		[InlineData("LotWidth")]
		[InlineData("LotDepth")]
		public void ALotColumnSortsByWholeCellsEitherWayAndTiesOnEqualLots(string column)
		{
			var entries = new[]
			{
				TestEntries.Make(1, "Wide", lotWidth: 6, lotDepth: 6),
				TestEntries.Make(2, "Narrow", lotWidth: 2, lotDepth: 2),
				TestEntries.Make(3, "Middle", lotWidth: 4, lotDepth: 4),
			};

			Assert.Equal(
				new[] { "Narrow", "Middle", "Wide" },
				BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(SortColumn: column)).Items.Select(entry => entry.Name));
			Assert.Equal(
				new[] { "Wide", "Middle", "Narrow" },
				BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(SortColumn: column, Descending: true)).Items.Select(entry => entry.Name));

			var twins = new[] { entries[0], entries[1] with { LotWidth = 6, LotDepth = 6 } };

			Assert.Equal(new[] { column }, BuildingCatalogQueryEngine.ReorderableSortColumns(entries, new BuildingCatalogQuery(), new[] { column }));
			Assert.Empty(BuildingCatalogQueryEngine.ReorderableSortColumns(twins, new BuildingCatalogQuery(), new[] { column }));
		}
	}
}
