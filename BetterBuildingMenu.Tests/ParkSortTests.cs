using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Parks sort by what they give: Recreation (the leisure they provide) and Attractiveness.</summary>
	public sealed class ParkSortTests
	{
		private static readonly BuildingCatalogEntry[] Parks =
		{
			TestEntries.Make(1, "Small Park") with { LeisureEfficiency = 10, ServiceFacts = new[] { new ServiceFact("attractiveness", 30) } },
			TestEntries.Make(2, "Large Park") with { LeisureEfficiency = 40, ServiceFacts = new[] { new ServiceFact("attractiveness", 10) } },
			TestEntries.Make(3, "Plaza") with { LeisureEfficiency = 25 },
			TestEntries.Make(4, "Bench"),
		};

		private static string[] Order(string column, bool descending) =>
			BuildingCatalogQueryEngine.Query(Parks, new BuildingCatalogQuery(SortColumn: column, Descending: descending, Limit: 100))
				.Items.Select(entry => entry.Name).ToArray();

		[Fact]
		public void RecreationOrdersByTheLeisureAParkGivesThoseWithNoneLast()
		{
			Assert.Equal(new[] { "Large Park", "Plaza", "Small Park", "Bench" }, Order("Recreation", descending: true));
			Assert.Equal(new[] { "Small Park", "Plaza", "Large Park", "Bench" }, Order("Recreation", descending: false));
		}

		[Fact]
		public void AttractivenessOrdersByTheGamesFigureThoseWithNoneLast()
		{
			Assert.Equal(new[] { "Small Park", "Large Park" }, Order("Attractiveness", descending: true).Take(2));
			Assert.Equal(new[] { "Bench", "Plaza" }, Order("Attractiveness", descending: true).Skip(2).OrderBy(name => name));
		}

		[Fact]
		public void BothAreOfferedOnlyWhereTheyReorderSomething()
		{
			var candidates = BuildingCatalogSortColumns.Ids;
			Assert.Contains("Recreation", BuildingCatalogQueryEngine.ReorderableSortColumns(Parks, new BuildingCatalogQuery(), candidates));
			Assert.Contains("Attractiveness", BuildingCatalogQueryEngine.ReorderableSortColumns(Parks, new BuildingCatalogQuery(), candidates));

			var roads = new[] { TestEntries.Make(5, "Avenue"), TestEntries.Make(6, "Street") };
			Assert.DoesNotContain("Recreation", BuildingCatalogQueryEngine.ReorderableSortColumns(roads, new BuildingCatalogQuery(), candidates));
			Assert.DoesNotContain("Attractiveness", BuildingCatalogQueryEngine.ReorderableSortColumns(roads, new BuildingCatalogQuery(), candidates));
		}
	}
}
