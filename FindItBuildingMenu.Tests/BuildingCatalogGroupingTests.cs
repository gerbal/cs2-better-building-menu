using System.Linq;
using FindItBuildingMenu.Domain;
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
				BuildingCatalogGrouping.Role,
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
	}
}
