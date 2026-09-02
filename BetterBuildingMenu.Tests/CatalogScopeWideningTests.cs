using System.Collections.Generic;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// cm-2xvs.21: removing the menu scope must widen the catalogue.
	/// </summary>
	/// <remarks>
	/// Measured in the 105-pack scale run before the fix: Landscaping scoped
	/// showed 514 and Roads &amp; Networks 403, while clearing the scope showed
	/// 715 — fewer than those two menus together, out of 1,465 placements the
	/// backend held. The unscoped arm asked our own taxonomy (IsBuilding) while
	/// the scoped arm asked the game's menu tree, so the two could disagree by
	/// any amount and nothing noticed.
	///
	/// These assert the RELATION rather than either arm's contents, because the
	/// contents need a live index and the relation does not. The numbers above
	/// belong in the bead; what belongs here is that no combination of facts
	/// can make a scoped view hold something the unscoped view drops.
	/// </remarks>
	public sealed class CatalogScopeWideningTests
	{
		/// <summary>
		/// Every combination of the four facts, minus the impossible ones.
		/// </summary>
		/// <remarks>
		/// Two implications hold in the live index and would otherwise generate
		/// states that cannot occur: an asset placed in THIS menu is placed in
		/// some menu, and IsGatheredNetwork is itself guarded on
		/// IsPlacedInAnyMenu (its remarks say why — the index also holds
		/// networks vanilla never offers).
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
			// The regression in one line: a Landscaping prop is placed in that
			// menu and is not a building, so the scoped view held it and the
			// unscoped view did not.
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
			// The client reads "All" as the sum of the count table (see
			// categoryCount in vanillaMenuCategories.ts), so a row the backend
			// drops is a row All never counts. Unscoped, the dropped row is the
			// big one: 9,812 of 10,528 assets answered to no category, and the
			// strip said 716.
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
			// cm-wdap, decided by the user 2026-08-27: the 314 props our own
			// generators emit are FindIt's, not the lens's. FindIt answers
			// "where is any asset"; the lens answers "what should I build here,
			// and what does it cost me". A quantity variant of a shopping
			// trolley has no answer to the second question.
			//
			// This is the shape they arrive in. A generated prop is a
			// StaticObjectPrefab, so IsBuilding is false, and both generators
			// set UIObject.m_Group = null, so vanilla places them in no menu —
			// which is what keeps them out, at both scopes, with no special
			// case anywhere.
			//
			// So this test is a DECISION, not a floor. Read it before adding a
			// Has<BuildingMenuGenerated> arm to BelongsInCatalog: that change is a
			// reversal, not a fix, and it also arms the exact population
			// cm-2xvs.13 warns about — group-less prefabs, which null the
			// toolbar's menu and category and unmount the panel under the
			// player.
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
