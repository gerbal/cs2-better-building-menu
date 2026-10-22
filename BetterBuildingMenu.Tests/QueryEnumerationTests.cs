using System.Collections;
using System.Collections.Generic;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class QueryEnumerationTests
	{
		/// <summary>Counts how many times it is walked; the walk itself is the fact under test.</summary>
		private sealed class Counting : IEnumerable<BuildingCatalogEntry>
		{
			private readonly BuildingCatalogEntry[] _items;
			public int Walks { get; private set; }
			public Counting(params BuildingCatalogEntry[] items) => _items = items;
			public IEnumerator<BuildingCatalogEntry> GetEnumerator() { Walks++; return ((IEnumerable<BuildingCatalogEntry>)_items).GetEnumerator(); }
			IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
		}

		private static BuildingCatalogEntry Entry(int id, string name, int cost) =>
			TestEntries.Make(id, name, category: "Buildings", subCategory: "Buildings_Residential", lotWidth: 2, lotDepth: 2)
				with { ConstructionCost = cost };

		[Fact]
		public void QueryWalksItsInputOnce()
		{
			// Count, order and the reorderable-column scan share one materialised
			// pass rather than re-running Matches over a lazy Where.
			var source = new Counting(Entry(1, "A", 10), Entry(2, "B", 20), Entry(3, "C", 30));

			var page = BuildingCatalogQueryEngine.Query(source, new BuildingCatalogQuery(SortColumn: "ConstructionCost"));

			Assert.Equal(3, page.TotalCount);
			Assert.Equal(1, source.Walks);
		}
	}
}
