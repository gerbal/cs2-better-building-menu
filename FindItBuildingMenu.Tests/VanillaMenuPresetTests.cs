using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class VanillaMenuPresetTests
	{
		[Theory]
		// The names below are the UIAssetMenuPrefab names read off the running
		// toolbar's uiTag, not the icon filenames. Only four of eleven matched:
		// the Healthcare button's menu is actually "Health & Deathcare".
		[InlineData("Electricity", PrefabSubCategory.ServiceBuildings_Electricity)]
		[InlineData("Water & Sewage", PrefabSubCategory.ServiceBuildings_Water)]
		[InlineData("Health & Deathcare", PrefabSubCategory.ServiceBuildings_Health)]
		[InlineData("Garbage Management", PrefabSubCategory.ServiceBuildings_Garbage)]
		[InlineData("Education & Research", PrefabSubCategory.ServiceBuildings_EducationResearch)]
		[InlineData("Fire & Rescue", PrefabSubCategory.ServiceBuildings_Fire)]
		[InlineData("Police & Administration", PrefabSubCategory.ServiceBuildings_Police)]
		[InlineData("Transportation", PrefabSubCategory.ServiceBuildings_Transportation)]
		[InlineData("Parks & Recreation", PrefabSubCategory.ServiceBuildings_Parks)]
		[InlineData("Communications", PrefabSubCategory.ServiceBuildings_Communications)]
		public void RoutesABuildingMenuStraightToItsSubCategory(string menu, PrefabSubCategory expected)
		{
			// The vanilla toolbar's building menus line up almost 1:1 with
			// PrefabSubCategory, so ten of the thirteen need no new query
			// surface at all.
			var preset = VanillaMenuPresets.Resolve(menu);

			Assert.NotNull(preset);
			Assert.Equal(expected, preset!.SubCategory);
			Assert.Equal(PrefabCategory.ServiceBuildings, preset.Category);
		}

		[Fact]
		public void MatchesMenuNamesCaseInsensitivelyAndIgnoresSurroundingSpace()
		{
			// The name arrives from a prefab, not from a literal in this file.
			Assert.NotNull(VanillaMenuPresets.Resolve("  electricity "));
			Assert.NotNull(VanillaMenuPresets.Resolve("HEALTH & DEATHCARE"));
		}

		[Theory]
		[InlineData("Roads")]
		[InlineData("Landscaping")]
		[InlineData("Areas")]
		public void DeclinesTheMenusThatAreNotBuildings(string menu)
		{
			// Roads are networks and Landscaping is surfaces; neither is in the
			// building catalog. Declining lets the vanilla menu handle them
			// rather than opening an empty lens.
			Assert.Null(VanillaMenuPresets.Resolve(menu));
		}

		[Fact]
		public void DeclinesAMenuItHasNeverSeen()
		{
			// A modded toolbar menu must fall through to vanilla rather than
			// open the lens showing something unrelated.
			Assert.Null(VanillaMenuPresets.Resolve("SomeModdedMenu"));
			Assert.Null(VanillaMenuPresets.Resolve(""));
			Assert.Null(VanillaMenuPresets.Resolve(null));
		}

		[Fact]
		public void RoutesZonesToTheZoningHierarchyRatherThanASubCategory()
		{
			// Zones are assignment tools, not buildings: the preset opens the
			// zoning hierarchy instead of filtering the building table.
			var preset = VanillaMenuPresets.Resolve("Zones");

			Assert.NotNull(preset);
			Assert.True(preset!.IsZoning);
		}

		[Fact]
		public void ABuildingPresetIsNotAZoningOne()
		{
			Assert.False(VanillaMenuPresets.Resolve("Electricity")!.IsZoning);
	}

	[Fact]
	public void RoutesSignatureBuildingsToTheCatalog()
	{
		// Signature buildings are in the catalog, and the menu exists on the
		// toolbar; it was missed until the real menu list was read from the
		// game rather than inferred from toolbar icons.
		var preset = VanillaMenuPresets.Resolve("Signatures");

		Assert.NotNull(preset);
		Assert.False(preset!.IsZoning);
		}

		[Fact]
		public void CoversEveryBuildingMenuOnTheToolbar()
		{
			// Read off the running toolbar. If the game adds a menu, this fails
			// rather than silently leaving it on the vanilla grid.
			// Ten service menus, Zones, and Signatures. Roads, Landscaping and
		// Areas are deliberately absent.
		Assert.Equal(12, VanillaMenuPresets.Known.Count);
		}
	}
}
