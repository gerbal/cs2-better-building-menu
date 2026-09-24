using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class CategoryFilingTests
	{
		[Fact]
		public void ANewIndexIsLaidOutEmptyAndNotReady()
		{
			var index = new CatalogIndex();

			Assert.False(index.IsReady);
			Assert.Empty(index.All);
			Assert.NotNull(index.List(PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
			// A subcategory is laid out only under its own category.
			Assert.Null(index.List(PrefabCategory.Props, PrefabSubCategory.Networks_Roads));
		}

		[Fact]
		public void AnEntryIsListedUnderEverythingItsCategoryAndItsSubcategory()
		{
			var index = new CatalogIndex();
			var road = TestPrefabs.Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);

			index.File(road);

			Assert.Same(road, index.Get(7));
			Assert.Same(road, ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Any)[7]);
			Assert.Same(road, ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads)[7]);
		}

		[Fact]
		public void ALaterClaimOnTheSamePrefabLeavesItListedUnderOneCategoryOnly()
		{
			// Two processors can claim one prefab. The later entry wins, and the earlier
			// one must not stay behind in the lists only it was filed in.
			var index = new CatalogIndex();
			var earlier = TestPrefabs.Entry(7, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Electricity);
			var later = TestPrefabs.Entry(7, PrefabCategory.Props, PrefabSubCategory.Props_Misc);

			index.File(earlier);
			index.File(later);

			Assert.Same(later, index.Get(7));
			Assert.Same(later, ListOf(index, PrefabCategory.Props, PrefabSubCategory.Any)[7]);
			Assert.Same(later, ListOf(index, PrefabCategory.Props, PrefabSubCategory.Props_Misc)[7]);
			Assert.False(ListOf(index, PrefabCategory.ServiceBuildings, PrefabSubCategory.Any).Contains(7));
			Assert.False(ListOf(index, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Electricity).Contains(7));
		}

		[Fact]
		public void RefilingInTheSameCategoryKeepsOneEntry()
		{
			var index = new CatalogIndex();

			index.File(TestPrefabs.Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
			index.File(TestPrefabs.Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));

			Assert.Single(index.All);
			Assert.Single(ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
		}

		[Fact]
		public void RemovingAnEntryTakesItOutOfEveryList()
		{
			var index = new CatalogIndex();
			index.File(TestPrefabs.Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));

			index.Remove(7);
			// Removing what is not there is a no-op, as a partial pass relies on.
			index.Remove(8);

			Assert.Null(index.Get(7));
			Assert.Empty(ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Any));
			Assert.Empty(ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
		}

		[Fact]
		public void FindLooksAnEntryUpByPrefabName()
		{
			var index = new CatalogIndex();
			var road = TestPrefabs.Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			road.PrefabName = "Small Road";
			index.File(road);

			Assert.True(index.Find("Small Road", out var id));
			Assert.Equal(7, id);
			Assert.False(index.Find("Highway", out _));
		}

		[Fact]
		public void AnUnindexedIdHasNoEntryAndNoPrefab()
		{
			var index = new CatalogIndex();

			Assert.Null(index.Get(0));
			Assert.Null(index.GetPrefab(0));
		}

		private static IndexedPrefabList ListOf(CatalogIndex index, PrefabCategory category, PrefabSubCategory subCategory)
		{
			var list = index.List(category, subCategory);
			Assert.NotNull(list);
			return list;
		}
	}
}
