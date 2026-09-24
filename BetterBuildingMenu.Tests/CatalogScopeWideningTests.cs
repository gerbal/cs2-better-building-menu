using System.Collections.Generic;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Removing the menu scope widens the catalogue, never narrows it.
	/// </summary>
	/// <remarks>
	/// These assert the RELATION rather than either arm's contents, because the
	/// contents need a live index and the relation does not: no combination of
	/// facts can make a scoped view hold something the unscoped view drops.
	/// </remarks>
	public sealed class CatalogScopeWideningTests
	{
		/// <summary>
		/// Every combination of the four facts, minus the impossible ones.
		/// </summary>
		/// <remarks>
		/// Two implications hold in the live index and would otherwise generate
		/// states that cannot occur: an asset placed in THIS menu is placed in some
		/// menu, and IsGatheredNetwork is itself guarded on VanillaMenuIndex.IsPlaced.
		/// </remarks>
		public static IEnumerable<object[]> ReachableStates()
		{
			foreach (var isBuilding in new[] { false, true })
			foreach (var placedInAnyMenu in new[] { false, true })
			foreach (var placedInThisMenu in new[] { false, true })
			foreach (var gatheredNetwork in new[] { false, true })
			{
				if (placedInThisMenu && !placedInAnyMenu)
				{
					continue;
				}

				if (gatheredNetwork && !placedInAnyMenu)
				{
					continue;
				}

				yield return new object[] { isBuilding, placedInAnyMenu, placedInThisMenu, gatheredNetwork };
			}
		}

		[Theory]
		[MemberData(nameof(ReachableStates))]
		public void AnythingAMenuShowsTheUnscopedCatalogAlsoShows(
			bool isBuilding,
			bool placedInAnyMenu,
			bool placedInThisMenu,
			bool gatheredNetwork)
		{
			var scoped = BuildingCatalogAdapter.BelongsInCatalog(
				menuScoped: true,
				isBuilding: isBuilding,
				placedInThisMenu: placedInThisMenu,
				placedInAnyMenu: placedInAnyMenu,
				gatheredNetwork: gatheredNetwork);

			// The unscoped arm never sees a menu, so both menu-relative facts
			// come off — exactly as GetIndexedBuildings passes them.
			var unscoped = BuildingCatalogAdapter.BelongsInCatalog(
				menuScoped: false,
				isBuilding: isBuilding,
				placedInThisMenu: false,
				placedInAnyMenu: placedInAnyMenu,
				gatheredNetwork: false);

			if (scoped)
			{
				Assert.True(
					unscoped,
					$"a menu shows this asset but clearing the scope hides it "
					+ $"(isBuilding={isBuilding}, placedInAnyMenu={placedInAnyMenu}, "
					+ $"placedInThisMenu={placedInThisMenu}, gatheredNetwork={gatheredNetwork})");
			}
		}

		[Fact]
		public void TheOldRuleIsWhatThisTestWouldHaveCaught()
		{
			// A Landscaping prop is placed in its menu and is not a building, so
			// both scopes have to hold it.
			var prop = new { IsBuilding = false, PlacedInAnyMenu = true };

			Assert.True(BuildingCatalogAdapter.BelongsInCatalog(
				menuScoped: true,
				isBuilding: prop.IsBuilding,
				placedInThisMenu: true,
				placedInAnyMenu: prop.PlacedInAnyMenu,
				gatheredNetwork: false));

			Assert.True(BuildingCatalogAdapter.BelongsInCatalog(
				menuScoped: false,
				isBuilding: prop.IsBuilding,
				placedInThisMenu: false,
				placedInAnyMenu: prop.PlacedInAnyMenu,
				gatheredNetwork: false));
		}

		[Fact]
		public void TheAllCountIsTheSumOfEveryRowIncludingTheUnnamedOne()
		{
			// The client reads "All" as the sum of the count table, so a row the
			// backend drops is a row All never counts — the unnamed row included.
			var table = new[]
			{
				new MenuCategoryCount(string.Empty, 9812),
				new MenuCategoryCount("Vegetation", 22),
				new MenuCategoryCount("Pathways", 17),
			};

			Assert.Equal(9851, table.Sum(row => row.Count));

			// And the same table read as CATEGORIES holds two, not three —
			// which is what the expanded-category guards have to see.
			Assert.Equal(2, table.Count(row => row.Id.Length > 0));
		}

		[Fact]
		public void AnAssetVanillaPlacesNowhereStillNeedsToBeABuilding()
		{
			// The floor IsBuilding still sets. Without it the union would be a
			// straight replacement, and anything vanilla forgot to place would
			// vanish from the lens too.
			Assert.True(BuildingCatalogAdapter.BelongsInCatalog(
				menuScoped: false,
				isBuilding: true,
				placedInThisMenu: false,
				placedInAnyMenu: false,
				gatheredNetwork: false));

			Assert.False(BuildingCatalogAdapter.BelongsInCatalog(
				menuScoped: false,
				isBuilding: false,
				placedInThisMenu: false,
				placedInAnyMenu: false,
				gatheredNetwork: false));
		}

		[Fact]
		public void TheGeneratedPropsStayOutOfTheLensAtBothScopes()
		{
			// A prefab that is not a building and sits in no menu stays out at both
			// scopes, with no special case. Do not add an arm to BelongsInCatalog
			// that admits group-less prefabs: they unmount the panel under the player.
			foreach (var menuScoped in new[] { false, true })
			{
				Assert.False(BuildingCatalogAdapter.BelongsInCatalog(
					menuScoped: menuScoped,
					isBuilding: false,
					placedInThisMenu: false,
					placedInAnyMenu: false,
					gatheredNetwork: false));
			}
		}
	}
}
