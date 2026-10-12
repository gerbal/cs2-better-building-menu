using System;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The asset menu opens in the order the game itself draws.
	/// </summary>
	/// <remarks>
	/// Vanilla's sort is UIObject.m_Priority ascending and nothing else. It is
	/// authored per asset, so no other column reproduces it, which is why the sort
	/// is called "Default" rather than named after a field.
	/// </remarks>
	public sealed class DefaultSortOrderTests
	{
		private static BuildingCatalogEntry Asset(int id, string name, int uiOrder) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Roads", UiCategory = "RoadsSmallRoads", UIOrder = uiOrder };

		private static BuildingCatalogEntry Service(int id, string name, double? capacity, double? cost, int uiOrder = 0, double? households = null) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: "ServiceBuildings", SubCategory: "ServiceBuildings_Education",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UIOrder = uiOrder, Capacity = capacity, ConstructionCost = cost, Households = households };

		private static int[] Ids(BuildingCatalogQuery query, params BuildingCatalogEntry[] entries) =>
			BuildingCatalogQueryEngine.Query(entries, query).Items.Select(item => item.Id).ToArray();

		[Fact]
		public void TheAssetMenuOpensInTheGamesOwnOrder()
		{
			// Deliberately alphabetical-hostile: sorted by name this is Alley,
			// Gravel, Highway, and by priority it is the reverse.
			var entries = new[]
			{
				Asset(1, "Highway", 10),
				Asset(2, "Gravel Road", 20),
				Asset(3, "Alley", 30),
			};

			var page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(UiMenu: "Roads"));

			Assert.Equal(
				new[] { "Highway", "Gravel Road", "Alley" },
				page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void AnExplicitSortStillWins()
		{
			// "Default" is a choice like any other, which is the whole reason it
			// is named and offered rather than applied underneath.
			var entries = new[]
			{
				Asset(1, "Highway", 10),
				Asset(2, "Gravel Road", 20),
				Asset(3, "Alley", 30),
			};

			var page = BuildingCatalogQueryEngine.Query(
				entries,
				new BuildingCatalogQuery(UiMenu: "Roads", SortColumn: "Name"));

			Assert.Equal(
				new[] { "Alley", "Gravel Road", "Highway" },
				page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void EqualPrioritiesFallBackToTheNameRatherThanToChance()
		{
			// Vanilla leaves these to an unstable sort, which is fine for a menu
			// drawn once and not for a list that re-renders under the cursor.
			var entries = new[]
			{
				Asset(1, "Beta", 5),
				Asset(2, "Alpha", 5),
			};

			var page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(UiMenu: "Roads"));

			Assert.Equal(new[] { "Alpha", "Beta" }, page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void DefaultIsOfferedFirst()
		{
			Assert.Equal("Default", BuildingCatalogQuery.OfferedSortColumns[0]);
			Assert.Equal("Default", new BuildingCatalogQuery().EffectiveSortColumn);
			Assert.Equal("Default", new BuildingCatalogQuery(SortColumn: "  ").EffectiveSortColumn);
		}

		[Fact]
		public void EqualCapacitiesGoToTheCheaperBuildingThenToTheGamesOrder()
		{
			var ids = Ids(
				new BuildingCatalogQuery(SortColumn: "Capacity", Descending: true),
				Service(1, "Big School", 1000, 90000, uiOrder: 1),
				Service(2, "Dear School", 500, 80000, uiOrder: 2),
				Service(3, "Cheap School", 500, 20000, uiOrder: 3),
				Service(4, "Twin A", 500, 20000, uiOrder: 5),
				Service(5, "Twin B", 500, 20000, uiOrder: 4));

			Assert.Equal(new[] { 1, 3, 5, 4, 2 }, ids);
		}

		[Fact]
		public void ATieWithNoCostGoesAfterTheRowsThatHaveOne()
		{
			var ids = Ids(
				new BuildingCatalogQuery(SortColumn: "Capacity", Descending: true),
				Service(1, "Free School", 500, null),
				Service(2, "Paid School", 500, 70000));

			Assert.Equal(new[] { 2, 1 }, ids);
		}

		[Fact]
		public void TiesGoToTheCheaperBuildingWhicheverWayTheSortRuns()
		{
			var ids = Ids(
				new BuildingCatalogQuery(SortColumn: "Capacity"),
				Service(1, "Dear School", 500, 80000),
				Service(2, "Cheap School", 500, 20000),
				Service(3, "Small School", 100, 50000));

			Assert.Equal(new[] { 3, 2, 1 }, ids);
		}

		[Fact]
		public void TheNameSortKeepsItsOwnTies()
		{
			// By id, not by cost: two rows with one name are told apart by nothing a player reads.
			var ids = Ids(new BuildingCatalogQuery(SortColumn: "Name"), Service(1, "Same", 1, 90000), Service(2, "Same", 1, 10000));

			Assert.Equal(new[] { 1, 2 }, ids);
		}

		[Fact]
		public void HouseholdsWaterAndSewageCapacityAreSortsAndHouseholdsOrderByTheirCount()
		{
			Assert.Contains("Households", BuildingCatalogQuery.OfferedSortColumns);
			Assert.Contains("WaterCapacity", BuildingCatalogQuery.OfferedSortColumns);
			Assert.Contains("SewageCapacity", BuildingCatalogQuery.OfferedSortColumns);

			var ids = Ids(
				new BuildingCatalogQuery(SortColumn: "Households", Descending: true),
				Service(1, "Row Houses", null, 1000, households: 4),
				Service(2, "Tower", null, 1000, households: 120),
				Service(3, "Park", null, 1000));

			Assert.Equal(new[] { 2, 1, 3 }, ids);
		}

		[Theory]
		[InlineData("Workers")]
		[InlineData("Capacity")]
		[InlineData("Households")]
		[InlineData("WaterCapacity")]
		[InlineData("SewageCapacity")]
		public void TheFirstClickOnAMoreIsBetterSortIsHighestFirst(string column)
		{
			Assert.True(SortDefaults.StartsDescending(column));
			Assert.Contains(column, BuildingCatalogQuery.OfferedSortColumns);
		}

		[Theory]
		[InlineData("Default")]
		[InlineData("Name")]
		[InlineData("Category")]
		[InlineData("ConstructionCost")]
		[InlineData("Upkeep")]
		[InlineData("LotWidth")]
		[InlineData("LotDepth")]
		[InlineData("BuildingLevel")]
		[InlineData("HasParking")]
		public void TheFirstClickOnEveryOtherSortIsLowestFirst(string column)
		{
			Assert.False(SortDefaults.StartsDescending(column));
		}

		[Fact]
		public void EveryOfferedSortButTheGamesOrderAndTheWordSortsBreaksTiesByCost()
		{
			foreach (var column in BuildingCatalogQuery.OfferedSortColumns)
			{
				var words = column is "Default" or "Name" or "Category";

				Assert.True(SortDefaults.BreaksTiesByCost(column) != words, column);
			}
		}

		[Fact]
		public void TheNumericSetIsExactlyTheNumericSortKeysOfTheQueryEngine()
		{
			// Reads BuildingCatalogQueryEngine.cs as text: every key the engine orders by a number,
			// in Order and SortValueOf, must be in SortDefaults.Numeric, and nothing else may be.
			// A numeric sort added to the engine without joining the set fails here.
			var source = File.ReadAllText(EngineFile());
			var words = new[] { "default", "category", "subcategory" };
			var labels = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (Match arm in Regex.Matches(source, @"^\s*((?:""[a-z]+""(?:\s+or\s+)?)+)\s*=>", RegexOptions.Multiline))
			{
				foreach (Match label in Regex.Matches(arm.Groups[1].Value, "\"([a-z]+)\""))
				{
					if (!words.Contains(label.Groups[1].Value))
					{
						labels.Add(label.Groups[1].Value);
					}
				}
			}

			Assert.True(labels.Count >= 15, $"the scan found {labels.Count} sort keys; the engine's switch was restructured");
			Assert.Empty(labels.Except(SortDefaults.Numeric, StringComparer.OrdinalIgnoreCase));
			Assert.Empty(SortDefaults.Numeric.Except(labels, StringComparer.OrdinalIgnoreCase));
		}

		private static string EngineFile([CallerFilePath] string testFile = "") =>
			Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", "BetterBuildingMenu", "Services", "BuildingCatalogQueryEngine.cs"));
	}
}
