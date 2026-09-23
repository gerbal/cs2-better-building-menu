using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Utilities;

using System.Collections.Generic;
using System.Runtime.CompilerServices;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class CategoryFilingTests
	{
		[Fact]
		public void AnEntryIsListedUnderEverythingItsCategoryAndItsSubcategory()
		{
			var index = EmptyIndex();
			var road = Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);

			BuildingMenuUtil.File(index, road);

			Assert.Same(road, index[PrefabCategory.Any][PrefabSubCategory.Any][7]);
			Assert.Same(road, index[PrefabCategory.Networks][PrefabSubCategory.Any][7]);
			Assert.Same(road, index[PrefabCategory.Networks][PrefabSubCategory.Networks_Roads][7]);
		}

		[Fact]
		public void ALaterClaimOnTheSamePrefabLeavesItListedUnderOneCategoryOnly()
		{
			// Two processors can claim one prefab. The later entry wins, and the earlier
			// one must not stay behind in the lists only it was filed in.
			var index = EmptyIndex();
			var earlier = Entry(7, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Electricity);
			var later = Entry(7, PrefabCategory.Props, PrefabSubCategory.Props_Misc);

			BuildingMenuUtil.File(index, earlier);
			BuildingMenuUtil.File(index, later);

			Assert.Same(later, index[PrefabCategory.Any][PrefabSubCategory.Any][7]);
			Assert.Same(later, index[PrefabCategory.Props][PrefabSubCategory.Any][7]);
			Assert.Same(later, index[PrefabCategory.Props][PrefabSubCategory.Props_Misc][7]);
			Assert.False(index[PrefabCategory.ServiceBuildings][PrefabSubCategory.Any].Contains(7));
			Assert.False(index[PrefabCategory.ServiceBuildings][PrefabSubCategory.ServiceBuildings_Electricity].Contains(7));
		}

		[Fact]
		public void RefilingInTheSameCategoryKeepsOneEntry()
		{
			var index = EmptyIndex();

			BuildingMenuUtil.File(index, Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));
			BuildingMenuUtil.File(index, Entry(7, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads));

			Assert.Equal(1, index[PrefabCategory.Any][PrefabSubCategory.Any].Count);
			Assert.Equal(1, index[PrefabCategory.Networks][PrefabSubCategory.Networks_Roads].Count);
		}

		/// <remarks>
		/// Built without its constructor: the constructor loads the game's prefab types, which
		/// the mock assemblies CI builds against cannot load. Filing reads only these three.
		/// </remarks>
		private static PrefabIndex Entry(int id, PrefabCategory category, PrefabSubCategory subCategory)
		{
			var entry = (PrefabIndex)RuntimeHelpers.GetUninitializedObject(typeof(PrefabIndex));
			entry.Id = id;
			entry.Category = category;
			entry.SubCategory = subCategory;
			return entry;
		}

		/// <summary>Its own index, laid out like the live one, so no test touches the shared static.</summary>
		private static Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> EmptyIndex()
		{
			var index = new Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>>();

			foreach (var (category, subCategory) in new[]
			{
				(PrefabCategory.Any, PrefabSubCategory.Any),
				(PrefabCategory.Networks, PrefabSubCategory.Any),
				(PrefabCategory.Networks, PrefabSubCategory.Networks_Roads),
				(PrefabCategory.ServiceBuildings, PrefabSubCategory.Any),
				(PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Electricity),
				(PrefabCategory.Props, PrefabSubCategory.Any),
				(PrefabCategory.Props, PrefabSubCategory.Props_Misc),
			})
			{
				if (!index.TryGetValue(category, out var subCategories))
				{
					index[category] = subCategories = new Dictionary<PrefabSubCategory, IndexedPrefabList>();
				}

				subCategories[subCategory] = new IndexedPrefabList();
			}

			return index;
		}
	}
}
