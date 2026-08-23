using System;
using System.Linq;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class BuildingCatalogGroupingTests
	{
		private static BuildingCatalogEntry Entry(
			int id,
			string category = "ServiceBuildings",
			string subCategory = "Health",
			string name = "Thing",
			double? cost = 10_000,
			int width = 4,
			int depth = 4,
			string buildingType = "Hospital",
			string theme = "European",
			string provenance = "BaseGame",
			string dlcId = "") =>
			new BuildingCatalogEntry(
				Id: id,
				PrefabName: name,
				Name: name,
				Category: category,
				SubCategory: subCategory,
				Thumbnail: "",
				LotWidth: width,
				LotDepth: depth,
				BuildingLevel: 1,
				ZoneType: 0,
				HasParking: false,
				IsUniqueMesh: false,
				IsVanilla: true,
				IsFavorited: false,
				PdxModsId: "",
				BuildingType: buildingType,
				Provenance: provenance,
				DlcId: dlcId,
				Theme: theme,
				ConstructionCost: cost);

		[Fact]
		public void GroupsAreContiguousAcrossTheWholeResult()
		{
			// The one property the ordering has to guarantee. If members of a
			// group are not adjacent, a page boundary lands mid-group and the
			// heading describes something other than what follows it.
			var source = new[]
			{
				Entry(1, subCategory: "Health", name: "A"),
				Entry(2, subCategory: "Education", name: "B"),
				Entry(3, subCategory: "Health", name: "C"),
				Entry(4, subCategory: "Education", name: "D"),
				Entry(5, subCategory: "Police", name: "E"),
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.SubCategory));

			var keys = page.Items.Select(entry => entry.SubCategory).ToArray();
			var runs = keys.Where((key, index) => index == 0 || key != keys[index - 1]).ToArray();

			Assert.Equal(runs.Length, runs.Distinct().Count());
		}

		[Fact]
		public void SortsWithinEachGroupByTheChosenColumn()
		{
			// Group by is a primary key; the player's sort still decides the
			// order inside each group.
			var source = new[]
			{
				Entry(1, subCategory: "Health", name: "Zebra"),
				Entry(2, subCategory: "Health", name: "Alpha"),
				Entry(3, subCategory: "Education", name: "Yak"),
				Entry(4, subCategory: "Education", name: "Bee"),
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.SubCategory, SortColumn: "Name"));

			var names = page.Items.Select(entry => entry.Name).ToArray();

			Assert.Equal(new[] { "Bee", "Yak", "Alpha", "Zebra" }, names);
		}

		[Fact]
		public void LeavesTheOrderUntouchedWhenNothingIsGrouped()
		{
			// The seed is a constant in this case, and OrderBy is stable, so
			// the sort must behave exactly as it did before grouping existed.
			var source = new[]
			{
				Entry(1, subCategory: "Health", name: "Zebra"),
				Entry(2, subCategory: "Education", name: "Alpha"),
			};

			var grouped = BuildingCatalogQueryEngine.Query(source, new BuildingCatalogQuery(GroupBy: "none"));
			var ungrouped = BuildingCatalogQueryEngine.Query(source, new BuildingCatalogQuery());

			Assert.Equal(
				ungrouped.Items.Select(entry => entry.Id),
				grouped.Items.Select(entry => entry.Id));
			Assert.Equal(new[] { "Alpha", "Zebra" }, grouped.Items.Select(entry => entry.Name));
		}

		[Fact]
		public void CategoryGroupsByCategoryThenSubCategory()
		{
			Assert.Equal("ServiceBuildings", BuildingCatalogGrouping.PrimaryKey(Entry(1), BuildingCatalogGrouping.Category));
			Assert.Equal("Health", BuildingCatalogGrouping.SecondaryKey(Entry(1), BuildingCatalogGrouping.Category));
		}

		[Fact]
		public void OnlyCategoryHasASecondLevel()
		{
			foreach (var dimension in new[]
			{
				BuildingCatalogGrouping.SubCategory,
				BuildingCatalogGrouping.MenuCategory,
				BuildingCatalogGrouping.Role,
				BuildingCatalogGrouping.SchoolTier,
				BuildingCatalogGrouping.Theme,
				BuildingCatalogGrouping.Source,
				BuildingCatalogGrouping.Cost,
				BuildingCatalogGrouping.Footprint,
			})
			{
				Assert.Equal(string.Empty, BuildingCatalogGrouping.SecondaryKey(Entry(1), dimension));
			}
		}

		[Fact]
		public void EveryDimensionProducesAKeyForAnEntryThatCarriesItsValue()
		{
			// PrimaryKey used to lowercase its input and switch on the
			// constants, so a dimension whose id is not all-lowercase could
			// never match its own case: "menuCategory" fell through to the
			// empty key and emitted no ordering at all. SubCategory had a
			// hand-written literal hiding the same fault. Nothing failed,
			// because the UI regroups whatever order it is handed — so only a
			// test that asks each dimension directly can catch the next one.
			var entry = Entry(1) with { UiCategory = "TransportationRoad", UiCategoryPriority = 20 };

			foreach (var dimension in new[]
			{
				BuildingCatalogGrouping.Category,
				BuildingCatalogGrouping.MenuCategory,
				BuildingCatalogGrouping.SubCategory,
				BuildingCatalogGrouping.Role,
				BuildingCatalogGrouping.SchoolTier,
				BuildingCatalogGrouping.Theme,
				BuildingCatalogGrouping.Source,
				BuildingCatalogGrouping.Density,
				BuildingCatalogGrouping.Footprint,
				BuildingCatalogGrouping.Cost,
			})
			{
				Assert.False(
					string.IsNullOrEmpty(BuildingCatalogGrouping.PrimaryKey(entry, dimension)),
					$"{dimension} produced no group key, so grouping by it orders nothing");
			}
		}

		[Fact]
		public void SchoolTiersOrderByCareerRatherThanByName()
		{
			// "College" and "High School" alphabetise into the wrong career
			// order, which is why this ranks rather than naming.
			var source = new[] { 4, 1, 3, 2 }
				.Select(level => Entry(level, name: $"School{level}") with { EducationLevel = level })
				.ToArray();

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.SchoolTier));

			Assert.Equal(new int?[] { 1, 2, 3, 4 }, page.Items.Select(entry => entry.EducationLevel).ToArray());
		}

		[Fact]
		public void EveryNonTierEducationLevelLandsInOneUnrankedGroup()
		{
			// 0 is a capacity-only school upgrade, 5 is the outside connection,
			// and null is every building in the catalog that is not a school.
			var unranked = BuildingCatalogGrouping.SchoolTierRank(null);

			Assert.Equal(unranked, BuildingCatalogGrouping.SchoolTierRank(0));
			Assert.Equal(unranked, BuildingCatalogGrouping.SchoolTierRank(5));
			Assert.True(
				string.CompareOrdinal(unranked, BuildingCatalogGrouping.SchoolTierRank(4)) > 0,
				"the tier-less group must sort after every real tier");
		}

		private static BuildingCatalogEntry MenuEntry(int id, string category, int priority, string name = "Thing") =>
			Entry(id, name: name) with { UiMenu = "Transportation", UiCategory = category, UiCategoryPriority = priority };

		[Fact]
		public void MenuCategoryGroupsFollowTheGamesTabOrderRatherThanTheAlphabet()
		{
			// Transportation's real strip order. Alphabetically this is Air,
			// Road, Ship, Subway, Train, Tram — so any test that passes both
			// ways is not testing anything.
			var source = new[]
			{
				MenuEntry(1, "TransportationTram", 60),
				MenuEntry(2, "TransportationAir", 10),
				MenuEntry(3, "TransportationSubway", 40),
				MenuEntry(4, "TransportationRoad", 20),
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.MenuCategory));

			Assert.Equal(
				new[] { "TransportationAir", "TransportationRoad", "TransportationSubway", "TransportationTram" },
				page.Items.Select(entry => entry.UiCategory));
		}

		[Fact]
		public void MenuCategoryRankHandlesNegativePriorities()
		{
			// Signed int, so a naive zero-pad would sort every negative after
			// every positive, and -100 ahead of -99.
			var keys = new[] { 5, -100, -99, 0 }
				.Select(priority => BuildingCatalogGrouping.MenuCategoryRank("Category", priority))
				.ToArray();

			Assert.Equal(
				new[] { -100, -99, 0, 5 }.Select(priority => BuildingCatalogGrouping.MenuCategoryRank("Category", priority)),
				keys.OrderBy(key => key, System.StringComparer.OrdinalIgnoreCase));
		}

		[Fact]
		public void MenuCategoriesSharingAPriorityStayDistinctGroups()
		{
			// Vanilla's comparator has no tiebreak, but a group key must be a
			// function of the group: one key for two categories interleaves
			// their members and draws the same heading twice.
			Assert.NotEqual(
				BuildingCatalogGrouping.MenuCategoryRank("TransportationRoad", 20),
				BuildingCatalogGrouping.MenuCategoryRank("TransportationShip", 20));
		}

		[Fact]
		public void AssetsInNoMenuCategorySortAfterEveryNamedOne()
		{
			var unnamed = BuildingCatalogGrouping.PrimaryKey(
				Entry(1) with { UiCategory = null },
				BuildingCatalogGrouping.MenuCategory);

			Assert.True(
				string.CompareOrdinal(unnamed, BuildingCatalogGrouping.MenuCategoryRank("Anything", int.MaxValue)) > 0);
		}

		[Fact]
		public void SourcePrefersTheDlcNameOverTheBroadProvenance()
		{
			Assert.Equal(
				"BridgesAndPorts",
				BuildingCatalogGrouping.PrimaryKey(Entry(1, dlcId: "BridgesAndPorts"), BuildingCatalogGrouping.Source));
			Assert.Equal(
				"BaseGame",
				BuildingCatalogGrouping.PrimaryKey(Entry(1, dlcId: ""), BuildingCatalogGrouping.Source));
		}

		[Fact]
		public void RanksCostBandsNumericallyRatherThanByTheirLabels()
		{
			// Ordering the labels as text would put "₡100k+" before
			// "₡25k–₡100k". These edges are duplicated in buildingGroups.ts and
			// asserted there too; the two must agree.
			Assert.Equal("0", BuildingCatalogGrouping.CostRank(0));
			Assert.Equal("0", BuildingCatalogGrouping.CostRank(4_999));
			Assert.Equal("1", BuildingCatalogGrouping.CostRank(5_000));
			Assert.Equal("1", BuildingCatalogGrouping.CostRank(24_999));
			Assert.Equal("2", BuildingCatalogGrouping.CostRank(25_000));
			Assert.Equal("3", BuildingCatalogGrouping.CostRank(100_000));
			Assert.Equal("3", BuildingCatalogGrouping.CostRank(999_999));
		}

		[Fact]
		public void SortsEntriesWithNoValueAfterEveryBand()
		{
			// Not before the cheapest band, which is where an empty key would
			// put them.
			Assert.Equal("9", BuildingCatalogGrouping.CostRank(null));
			Assert.Equal("9", BuildingCatalogGrouping.FootprintRank(0, 0));

			Assert.True(string.CompareOrdinal(
				BuildingCatalogGrouping.CostRank(null),
				BuildingCatalogGrouping.CostRank(999_999)) > 0);
		}

		[Fact]
		public void SortsTheUnnamedGroupAfterEveryNamedOne()
		{
			// An empty key sorts first, which opened Police & Administration
			// grouped by role on the six buildings that have no role.
			string unnamed = BuildingCatalogGrouping.PrimaryKey(
				Entry(1, buildingType: ""), BuildingCatalogGrouping.Role);
			string named = BuildingCatalogGrouping.PrimaryKey(
				Entry(2, buildingType: "Zoo"), BuildingCatalogGrouping.Role);

			Assert.True(string.CompareOrdinal(unnamed, named) > 0);
		}

		[Fact]
		public void BandsAFootprintByItsLongerSide()
		{
			Assert.Equal("0", BuildingCatalogGrouping.FootprintRank(2, 2));
			Assert.Equal("2", BuildingCatalogGrouping.FootprintRank(2, 6));
			Assert.Equal("1", BuildingCatalogGrouping.FootprintRank(3, 3));
			Assert.Equal("3", BuildingCatalogGrouping.FootprintRank(20, 1));
		}

		[Fact]
		public void TreatsAnUnknownOrAbsentDimensionAsNoGrouping()
		{
			Assert.False(BuildingCatalogGrouping.IsGrouped(null));
			Assert.False(BuildingCatalogGrouping.IsGrouped(""));
			Assert.False(BuildingCatalogGrouping.IsGrouped("   "));
			Assert.False(BuildingCatalogGrouping.IsGrouped("none"));
			Assert.True(BuildingCatalogGrouping.IsGrouped("category"));

			// Unknown but non-"none" still yields an empty key rather than
			// throwing, so a UI that sends something stale degrades to flat.
			Assert.Equal(string.Empty, BuildingCatalogGrouping.PrimaryKey(Entry(1), "assetPack"));
		}
		[Fact]
		public void RanksDensityByTheDecidedOrderRatherThanTheEnumValue()
		{
			// Low, Row, Medium, Mixed, LowRent, High — the order the player
			// meets them in. The enum values are 1, 2, 4, 32, 64, 8, so the raw
			// number puts Mixed and LowRent past High and past Signature.
			//
			// The old key WAS that raw number, and it sorted correctly only by
			// accident of the flag values. The accident stops working the
			// moment the vocabulary grows, which is now.
			var ranked = new[]
			{
				ZoneTypeFilter.Low,
				ZoneTypeFilter.Row,
				ZoneTypeFilter.Medium,
				ZoneTypeFilter.Mixed,
				ZoneTypeFilter.LowRent,
				ZoneTypeFilter.High,
			}.Select(BuildingCatalogGrouping.DensityRank).ToArray();

			Assert.Equal(ranked.OrderBy(rank => rank, StringComparer.Ordinal).ToArray(), ranked);
		}

		[Fact]
		public void SortsUntieredZonesAfterEveryRankedTier()
		{
			// Industrial and the extractor areas carry no tier. They belong at
			// the end, like every other group defined by absence.
			Assert.True(
				string.CompareOrdinal(
					BuildingCatalogGrouping.DensityRank(ZoneTypeFilter.High),
					BuildingCatalogGrouping.DensityRank(ZoneTypeFilter.Any)) < 0);
		}
	}
}
