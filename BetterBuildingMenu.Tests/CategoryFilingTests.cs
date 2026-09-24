using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;

using System.Linq;

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
		public void AnEntryIsListedUnderEverythingAndItsSubcategoryOnly()
		{
			var index = new CatalogIndex();
			var road = TestPrefabs.Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);

			index.File(road);

			Assert.Same(road, index.Get(7));
			Assert.Same(road, ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads)[7]);
			// Not a second copy under its category's catch-all: nothing reads one.
			Assert.Empty(ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Any));
		}

		[Fact]
		public void AnEntryFiledUnderItsCategoryAloneIsListedInTheCatchAll()
		{
			// A Find It override can name a category and no subcategory.
			var index = new CatalogIndex();
			var tree = TestPrefabs.Entry(7, PrefabCategory.Trees, PrefabSubCategory.Any);

			index.File(tree);
			Assert.Same(tree, ListOf(index, PrefabCategory.Trees, PrefabSubCategory.Any)[7]);

			index.Remove(7);
			Assert.Empty(ListOf(index, PrefabCategory.Trees, PrefabSubCategory.Any));
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
			Assert.Same(later, ListOf(index, PrefabCategory.Props, PrefabSubCategory.Props_Misc)[7]);
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
			Assert.Empty(index.All);
			Assert.Empty(ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
		}

		[Fact]
		public void AnEntryIsFoundByItsPrefabName()
		{
			var index = TestPrefabs.ReadyIndex(TestPrefabs.Named(7, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));

			Assert.Equal(7, index.GetByPrefabName("Small Road")?.Id);
			Assert.Null(index.GetByPrefabName("Highway"));
			// Names are exact, as the game's are.
			Assert.Null(index.GetByPrefabName("small road"));
		}

		[Fact]
		public void TheFirstInNameOrderAnswersWhenTwoShareAPrefabName()
		{
			var index = TestPrefabs.ReadyIndex(
				TestPrefabs.Named(7, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads, "Small Road B"),
				TestPrefabs.Named(8, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads, "Small Road A"));

			Assert.Equal(8, index.GetByPrefabName("Small Road")?.Id);
		}

		[Fact]
		public void TheFirstInNameOrderAnswersAcrossCategories()
		{
			// Not the first category's, the first filed or the lowest id: the one first by name,
			// which here is in the later category, filed last, with the higher id.
			var index = TestPrefabs.ReadyIndex(
				TestPrefabs.Named(7, "Shared", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads, "Zeta"),
				TestPrefabs.Named(8, "Shared", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Alpha"));

			Assert.Equal(8, index.GetByPrefabName("Shared")?.Id);
		}

		[Fact]
		public void ANamesakeFiledAfterALookupThatSortsFirstAnswersNext()
		{
			var index = TestPrefabs.ReadyIndex(TestPrefabs.Named(7, "Shared", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Zeta"));
			Assert.Equal(7, index.GetByPrefabName("Shared")?.Id);

			index.File(TestPrefabs.Named(9, "Shared", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Alpha"));

			Assert.Equal(9, index.GetByPrefabName("Shared")?.Id);
		}

		[Fact]
		public void TheNameLookupFollowsFilingAndRemoving()
		{
			// Built on first use, so a lookup made before an edit must not answer after it.
			var index = TestPrefabs.ReadyIndex(TestPrefabs.Named(7, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
			Assert.Equal(7, index.GetByPrefabName("Small Road")?.Id);

			index.Remove(7);
			Assert.Null(index.GetByPrefabName("Small Road"));

			index.File(TestPrefabs.Named(9, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
			Assert.Equal(9, index.GetByPrefabName("Small Road")?.Id);
		}

		[Fact]
		public void RepeatedNamesAreNumberedInPrefabNameOrderAndUpgradesAreNot()
		{
			var wingA = TestPrefabs.Named(1, "SchoolWing01", PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_EducationResearch, "Extension Wing");
			var wingB = TestPrefabs.Named(2, "SchoolWing02", PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_EducationResearch, "Extension Wing");
			wingA.IsServiceUpgrade = wingB.IsServiceUpgrade = true;
			var index = TestPrefabs.ReadyIndex(
				TestPrefabs.Named(4, "Park02", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Park"),
				TestPrefabs.Named(3, "Park01", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Park"),
				TestPrefabs.Named(5, "Fountain", PrefabCategory.Props, PrefabSubCategory.Props_Misc),
				wingA,
				wingB);

			index.NumberDuplicateNames();

			Assert.Equal("Park 1", index.Get(3)?.Name);
			Assert.Equal("Park 2", index.Get(4)?.Name);
			Assert.Equal("Fountain", index.Get(5)?.Name);
			Assert.Equal("Extension Wing", index.Get(1)?.Name);
			Assert.Equal("Extension Wing", index.Get(2)?.Name);
		}

		[Fact]
		public void NamesakesThatShareAPrefabNameTooAreNumberedInIdOrder()
		{
			// Nothing else tells them apart, and a pass files them in whatever order the game's
			// queries give.
			var index = TestPrefabs.ReadyIndex(
				TestPrefabs.Named(4, "Park01", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Park"),
				TestPrefabs.Named(3, "Park01", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Park"));

			index.NumberDuplicateNames();

			Assert.Equal("Park 1", index.Get(3)?.Name);
			Assert.Equal("Park 2", index.Get(4)?.Name);
		}

		[Fact]
		public void NumberingReordersEveryListAndTheNameLookup()
		{
			// Lists are in name order, cached; numbering renames, so every order and the
			// name lookup's choice between namesakes must be worked out again.
			var zeta = TestPrefabs.Named(1, "Shared", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Zeta");
			var alpha = TestPrefabs.Named(2, "Shared", PrefabCategory.Props, PrefabSubCategory.Props_Misc, "Alpha");
			var index = TestPrefabs.ReadyIndex(zeta, alpha);
			Assert.Equal(2, index.GetByPrefabName("Shared")?.Id);
			Assert.Equal(new[] { 2, 1 }, ListOf(index, PrefabCategory.Props, PrefabSubCategory.Props_Misc).Select(entry => entry.Id));

			zeta.AssetName = "Aardvark";
			index.NumberDuplicateNames();

			Assert.Equal(1, index.GetByPrefabName("Shared")?.Id);
			Assert.Equal(new[] { 1, 2 }, ListOf(index, PrefabCategory.Props, PrefabSubCategory.Props_Misc).Select(entry => entry.Id));
			Assert.Equal(new[] { 1, 2 }, index.All.Select(entry => entry.Id));
		}

		[Fact]
		public void BrandCleanupTakesANamesakeOutOfItsSubcategoryOnly()
		{
			var brand = TestPrefabs.Named(1, "Brand01", PrefabCategory.Props, PrefabSubCategory.Props_Branding);
			var namesake = TestPrefabs.Named(2, "Brand01", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			var road = TestPrefabs.Named(3, "Road01", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			var index = TestPrefabs.ReadyIndex(brand, namesake, road);

			var removed = index.RemoveBrandDuplicates();

			Assert.Equal(new[] { (2, PrefabSubCategory.Networks_Roads) }, removed.Select(taken => (taken.Entry.Id, taken.From)));
			Assert.Equal(new[] { 3 }, ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads).Select(entry => entry.Id));
			// Everything, which the catalog reads, and the brands' own list keep theirs.
			Assert.Equal(new[] { 1, 2, 3 }, index.All.Select(entry => entry.Id).OrderBy(id => id));
			Assert.Equal(new[] { 1 }, ListOf(index, PrefabCategory.Props, PrefabSubCategory.Props_Branding).Select(entry => entry.Id));
			Assert.Empty(index.RemoveBrandDuplicates());
		}

		[Fact]
		public void BrandCleanupTakesEveryNamesakeOutAndReportsEach()
		{
			// One in a subcategory, one filed under Props alone: the brand itself is not in
			// Props' catch-all, so nothing there is the brand's to keep.
			var index = TestPrefabs.ReadyIndex(
				TestPrefabs.Named(1, "Brand01", PrefabCategory.Props, PrefabSubCategory.Props_Branding),
				TestPrefabs.Named(2, "Brand01", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads),
				TestPrefabs.Named(3, "Brand01", PrefabCategory.Props, PrefabSubCategory.Any),
				TestPrefabs.Named(4, "Road01", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));

			var removed = index.RemoveBrandDuplicates();

			Assert.Equal(
				new[] { (2, PrefabSubCategory.Networks_Roads), (3, PrefabSubCategory.Any) },
				removed.Select(taken => (taken.Entry.Id, taken.From)).OrderBy(taken => taken.Item1));
			Assert.Empty(ListOf(index, PrefabCategory.Props, PrefabSubCategory.Any));
			Assert.Equal(new[] { 4 }, ListOf(index, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads).Select(entry => entry.Id));
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
