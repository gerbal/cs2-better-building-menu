using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class FindItCategoryOverrideTests
	{
		[Fact]
		public void AnExclusionCountsBesideAnyInclude()
		{
			// Find It's rule: the include can be any mod's tag, not only ours.
			Assert.True(FindItCategoryOverride.Read(new[] { "W7/Buildings/Transport" }, new[] { "FindIt" }).Excluded);
			Assert.True(FindItCategoryOverride.Read(new[] { "FindIt/1/101" }, new[] { "BetterBuildingMenu/anything" }).Excluded);
		}

		[Fact]
		public void ABareExclusionLeavesTheAssetListed()
		{
			// Alone, exclude=FindIt opts out of Find It's prop generators, not its catalog.
			Assert.False(FindItCategoryOverride.Read(includes: null, excludes: new[] { "FindIt" }).Excluded);
			Assert.False(FindItCategoryOverride.Read(new string[0], new[] { "BetterBuildingMenu" }).Excluded);
		}

		[Fact]
		public void OnlyOurTagsExclude()
		{
			Assert.False(FindItCategoryOverride.Read(new[] { "W7/Buildings/Transport" }, new[] { "FindItExtras", "Signature", null }).Excluded);
		}

		[Fact]
		public void ReadsTheCategoryPairAndModsId()
		{
			var read = FindItCategoryOverride.Read(new[] { $"FindIt/{(int)PrefabCategory.Props}/{(int)PrefabSubCategory.Props_Branding}/12345" }, null);

			Assert.Equal(PrefabCategory.Props, read.Category);
			Assert.Equal(PrefabSubCategory.Props_Branding, read.SubCategory);
			Assert.Equal("12345", read.PdxModsId);
		}

		[Fact]
		public void IgnoresAPairTheIndexDoesNotFile()
		{
			// The index keys on the pair; one it does not lay out would throw there and
			// drop the asset. The processor's own classification stands instead.
			var misfiled = $"FindIt/{(int)PrefabCategory.Props}/{(int)PrefabSubCategory.Buildings_Residential}";
			var unknown = "FindIt/9999/10001";
			var anyCategory = $"FindIt/{(int)PrefabCategory.Any}/{(int)PrefabSubCategory.Any}";

			foreach (var tag in new[] { misfiled, unknown, anyCategory, "FindIt/x/y", "FindIt/100" })
			{
				var read = FindItCategoryOverride.Read(new[] { tag }, null);

				Assert.Null(read.Category);
				Assert.Null(read.SubCategory);
			}
		}

		[Fact]
		public void KeepsTheModsIdWhenThePairIsUnusable()
		{
			Assert.Equal("77", FindItCategoryOverride.Read(new[] { "FindIt/x/y/77" }, null).PdxModsId);
		}

		[Fact]
		public void FilesACategoryUnderAny()
		{
			var read = FindItCategoryOverride.Read(new[] { $"BetterBuildingMenu/{(int)PrefabCategory.Trees}/{(int)PrefabSubCategory.Any}" }, null);

			Assert.Equal(PrefabCategory.Trees, read.Category);
			Assert.Equal(PrefabSubCategory.Any, read.SubCategory);
		}

		[Fact]
		public void TheLastUsableIncludeWins()
		{
			var read = FindItCategoryOverride.Read(new[]
			{
				$"FindIt/{(int)PrefabCategory.Props}/{(int)PrefabSubCategory.Props_Branding}",
				"FindIt/9999/10001",
				"Other/100/101",
			}, null);

			Assert.Equal(PrefabSubCategory.Props_Branding, read.SubCategory);
		}

		[Fact]
		public void AnOverrideIsFiledExactlyWhereTheIndexHasAList()
		{
			// Read off a real index rather than a second copy of its layout rule. Any is
			// the one exception: the index has an everything list, but no override names it.
			var index = new CatalogIndex();

			foreach (PrefabCategory category in Enum.GetValues(typeof(PrefabCategory)))
			{
				foreach (PrefabSubCategory subCategory in Enum.GetValues(typeof(PrefabSubCategory)))
				{
					Assert.True(
						FindItCategoryOverride.IsFiled(category, subCategory)
							== (category is not PrefabCategory.Any && index.List(category, subCategory) is not null),
						$"{category}/{subCategory}");
				}
			}
		}
	}
}
