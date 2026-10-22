using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System.Linq;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The order every sort column gives both ways, plain, grouped and searched, and which columns
	/// can reorder a set. The set holds ties, absent values, case-only differences, and two rows sharing an
	/// id, whose order shows the sort is stable.</summary>
	public sealed class SortColumnOrderTests
	{
		private static BuildingCatalogEntry Row(
			int id, string name, string prefab, string category, string subCategory, int uiOrder,
			int width, int depth, int level, int parking,
			double? cost, double? upkeep, double? workers, double? capacity) =>
			TestEntries.Make(id, name, prefab, category, subCategory, width, depth, level) with
			{
				UIOrder = uiOrder,
				ParkingSlots = parking,
				ConstructionCost = cost,
				Upkeep = upkeep,
				Workers = workers,
				Capacity = capacity,
			};

		internal static readonly BuildingCatalogEntry[] Set =
		{
			Row(7, "Market", "Market", "", "Buildings_Commercial", 5, 3, 1, 2, 2, 800, 10, null, 7),
			Row(5, "Twin", "TwinA", "Buildings", "Buildings_Commercial", 5, 2, 2, 2, 2, 800, 10, 3, 7),
			Row(2, "clinic", "clinic", "servicebuildings", "ServiceBuildings_Health", 20, 2, 3, 1, 4, 5000, null, 10, null),
			Row(9, "Beta", "Beta", "Networks", "Networks_Roads", 5, 2, 2, 1, 0, 5000, 100, 10, 50),
			Row(4, "Zoo", "Zoo", "Buildings", "Buildings_Leisure", -3, 4, 4, 3, 12, 120000, 400, 0, 0),
			Row(3, "Alley", "Alley3", "Networks", "Networks_Roads", 5, 1, 1, 0, 0, null, null, null, null),
			Row(5, "Twin", "TwinB", "Buildings", "Buildings_Commercial", 5, 2, 2, 2, 2, 800, 10, 3, 7),
			Row(8, "Depot", "Depot", "Networks", "Networks_Tracks", 20, 1, 4, 0, 0, 0, -5, 3, null),
			Row(1, "Clinic", "Clinic", "ServiceBuildings", "ServiceBuildings_Health", 20, 2, 3, 1, 0, 5000, 100, 10, 50),
			Row(10, "Alley", "Alley10", "Networks", "Networks_Roads", 30, 1, 1, 0, 0, null, 0, null, 0),
		};

		internal static string OrderOf(string? column, bool descending) =>
			string.Join(" / ", new[]
			{
				Order(new BuildingCatalogQuery(SortColumn: column!, Descending: descending, Limit: 100)),
				Order(new BuildingCatalogQuery(SortColumn: column!, Descending: descending, Limit: 100, GroupBy: BuildingCatalogGrouping.Category)),
				Order(new BuildingCatalogQuery(SortColumn: column!, Descending: descending, Limit: 100, SearchText: "a")),
			});

		private static string Order(BuildingCatalogQuery query) =>
			string.Join(",", BuildingCatalogQueryEngine.Query(Set, query).Items.Select(entry => entry.PrefabName));

		/// <summary>Every column the picker offers, the alias and casings a caller could send, and ids that name none.</summary>
		internal static readonly string[] Candidates =
		{
			"Default", "default", "Name", "Category", "ConstructionCost", "Cost", "Upkeep", "Workers",
			"Capacity", "LotWidth", "LotDepth", "BuildingLevel", "HasParking", "Unknown", "",
		};

		internal static string ReorderableOf(string fixture)
		{
			var (entries, groupBy) = ReorderableFixture(fixture);
			var usable = BuildingCatalogQueryEngine.ReorderableSortColumns(
				entries, new BuildingCatalogQuery(GroupBy: groupBy), Candidates);

			return string.Join(",", usable.Select(column => column.Length == 0 ? "''" : column));
		}

		private static (BuildingCatalogEntry[] Entries, string GroupBy) ReorderableFixture(string fixture)
		{
			var plain = TestEntries.Make(1, "Clinic", "ClinicA");

			return fixture switch
			{
				"set" => (Set, ""),
				"set by category" => (Set, BuildingCatalogGrouping.Category),
				// Default orders by the game's priority but judges a tie by name.
				"priority only" => (new[] { plain with { UIOrder = 1 }, plain with { Id = 2, UIOrder = 9 } }, ""),
				"name case only" => (new[] { plain, plain with { Id = 2, Name = "clinic" } }, ""),
				"category case only" => (new[] { plain, plain with { Id = 2, Category = "servicebuildings" } }, ""),
				"cost absent against zero" => (new[] { plain with { ConstructionCost = 0 }, plain with { Id = 2 } }, ""),
				"parking count" => (new[] { plain with { ParkingSlots = 1 }, plain with { Id = 2, ParkingSlots = 2 } }, ""),
				"one row" => (new[] { plain }, ""),
				_ => (System.Array.Empty<BuildingCatalogEntry>(), ""),
			};
		}

		[Theory]
		[InlineData(null, false, "Zoo,Alley3,Beta,Market,TwinA,TwinB,Clinic,clinic,Depot,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData(null, true, "Alley10,Depot,Clinic,clinic,TwinA,TwinB,Market,Beta,Alley3,Zoo / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("Default", false, "Zoo,Alley3,Beta,Market,TwinA,TwinB,Clinic,clinic,Depot,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Default", true, "Alley10,Depot,Clinic,clinic,TwinA,TwinB,Market,Beta,Alley3,Zoo / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("default", false, "Zoo,Alley3,Beta,Market,TwinA,TwinB,Clinic,clinic,Depot,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("default", true, "Alley10,Depot,Clinic,clinic,TwinA,TwinB,Market,Beta,Alley3,Zoo / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("", false, "Zoo,Alley3,Beta,Market,TwinA,TwinB,Clinic,clinic,Depot,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("", true, "Alley10,Depot,Clinic,clinic,TwinA,TwinB,Market,Beta,Alley3,Zoo / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("  ", false, "Zoo,Alley3,Beta,Market,TwinA,TwinB,Clinic,clinic,Depot,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("  ", true, "Alley10,Depot,Clinic,clinic,TwinA,TwinB,Market,Beta,Alley3,Zoo / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("Name", false, "Alley3,Alley10,Beta,Clinic,clinic,Depot,Market,TwinA,TwinB,Zoo / TwinA,TwinB,Zoo,Alley3,Alley10,Beta,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Name", true, "Zoo,TwinA,TwinB,Market,Depot,Clinic,clinic,Beta,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData(" Name ", false, "Alley3,Alley10,Beta,Clinic,clinic,Depot,Market,TwinA,TwinB,Zoo / TwinA,TwinB,Zoo,Alley3,Alley10,Beta,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData(" Name ", true, "Zoo,TwinA,TwinB,Market,Depot,Clinic,clinic,Beta,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Category", false, "Market,Zoo,TwinA,TwinB,Alley3,Depot,Beta,Alley10,Clinic,clinic / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Category", true, "Clinic,clinic,Alley3,Depot,Beta,Alley10,Zoo,TwinA,TwinB,Market / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("ConstructionCost", false, "Depot,TwinA,TwinB,Market,Clinic,clinic,Beta,Zoo,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("ConstructionCost", true, "Zoo,Clinic,clinic,Beta,TwinA,TwinB,Market,Depot,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("constructioncost", false, "Depot,TwinA,TwinB,Market,Clinic,clinic,Beta,Zoo,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("constructioncost", true, "Zoo,Clinic,clinic,Beta,TwinA,TwinB,Market,Depot,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Cost", false, "Depot,TwinA,TwinB,Market,Clinic,clinic,Beta,Zoo,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Cost", true, "Zoo,Clinic,clinic,Beta,TwinA,TwinB,Market,Depot,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Upkeep", false, "Depot,Alley10,TwinA,TwinB,Market,Clinic,Beta,Zoo,clinic,Alley3 / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("Upkeep", true, "Zoo,Clinic,Beta,TwinA,TwinB,Market,Alley10,Depot,clinic,Alley3 / TwinA,TwinB,Zoo,Beta,Alley10,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("Workers", false, "Zoo,TwinA,TwinB,Depot,Clinic,clinic,Beta,Alley3,Market,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Workers", true, "Clinic,clinic,Beta,TwinA,TwinB,Depot,Zoo,Alley3,Market,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Capacity", false, "Zoo,Alley10,TwinA,TwinB,Market,Clinic,Beta,clinic,Alley3,Depot / TwinA,TwinB,Zoo,Alley10,Beta,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("Capacity", true, "Clinic,Beta,TwinA,TwinB,Market,Zoo,Alley10,clinic,Alley3,Depot / TwinA,TwinB,Zoo,Beta,Alley10,Alley3,Depot,Clinic,clinic,Market / Alley10,Alley3,Beta,Market,TwinA")]
		[InlineData("LotWidth", false, "Alley3,Depot,Alley10,Clinic,clinic,TwinA,TwinB,Beta,Market,Zoo / TwinA,TwinB,Zoo,Alley3,Alley10,Beta,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("LotWidth", true, "Zoo,Market,Clinic,clinic,TwinA,TwinB,Beta,Alley3,Depot,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("LotDepth", false, "Alley3,Market,Alley10,TwinA,TwinB,Beta,Clinic,clinic,Zoo,Depot / TwinA,TwinB,Zoo,Alley3,Alley10,Beta,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("LotDepth", true, "Zoo,Depot,Clinic,clinic,TwinA,TwinB,Beta,Alley3,Market,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("BuildingLevel", false, "Alley3,Depot,Alley10,Clinic,clinic,Beta,TwinA,TwinB,Market,Zoo / TwinA,TwinB,Zoo,Alley3,Alley10,Beta,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("BuildingLevel", true, "Zoo,TwinA,TwinB,Market,Clinic,clinic,Beta,Alley3,Depot,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("HasParking", false, "Clinic,Alley3,Depot,Beta,Alley10,TwinA,TwinB,Market,clinic,Zoo / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("HasParking", true, "Zoo,clinic,TwinA,TwinB,Market,Clinic,Alley3,Depot,Beta,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,clinic,Clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("HASPARKING", false, "Clinic,Alley3,Depot,Beta,Alley10,TwinA,TwinB,Market,clinic,Zoo / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("HASPARKING", true, "Zoo,clinic,TwinA,TwinB,Market,Clinic,Alley3,Depot,Beta,Alley10 / TwinA,TwinB,Zoo,Alley3,Beta,Alley10,Depot,clinic,Clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Unknown", false, "Alley3,Alley10,Beta,Clinic,clinic,Depot,Market,TwinA,TwinB,Zoo / TwinA,TwinB,Zoo,Alley3,Alley10,Beta,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		[InlineData("Unknown", true, "Zoo,TwinA,TwinB,Market,Depot,Clinic,clinic,Beta,Alley3,Alley10 / TwinA,TwinB,Zoo,Beta,Alley3,Alley10,Depot,Clinic,clinic,Market / Alley3,Alley10,Beta,Market,TwinA")]
		public void EachColumnOrdersTheSetBothWays(string? column, bool descending, string expected) =>
			Assert.Equal(expected, OrderOf(column, descending));

		[Theory]
		[InlineData("set", "Default,default,Name,Category,ConstructionCost,Cost,Upkeep,Workers,Capacity,LotWidth,LotDepth,BuildingLevel,HasParking,Unknown,''")]
		[InlineData("set by category", "Default,default,Name,ConstructionCost,Cost,Upkeep,Workers,Capacity,LotWidth,LotDepth,BuildingLevel,Unknown,''")]
		[InlineData("priority only", "")]
		[InlineData("name case only", "Default,default,Name,Unknown,''")]
		[InlineData("category case only", "Category")]
		[InlineData("cost absent against zero", "ConstructionCost,Cost")]
		[InlineData("parking count", "HasParking")]
		[InlineData("one row", "")]
		[InlineData("empty", "")]
		public void AColumnCanReorderASetWhenItsTieValuesDiffer(string fixture, string expected) =>
			Assert.Equal(expected, ReorderableOf(fixture));
	}
}
