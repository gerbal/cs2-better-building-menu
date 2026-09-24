using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Services;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The three availability states, and that they partition.
	/// </summary>
	public class AvailabilityStateTests
	{
		private static readonly BuildingCatalogEntry Base = new(
			Id: 0,
			PrefabName: "Base",
			Name: "Base",
			Category: "ServiceBuildings",
			SubCategory: "Any",
			Thumbnail: "",
			LotWidth: 1,
			LotDepth: 1,
			BuildingLevel: 1,
			ZoneType: Domain.Enums.ZoneTypeFilter.Any,
			HasParking: false,
			IsVanilla: true,
			PdxModsId: "");

		[Fact]
		public void AlreadyBuiltSupersedesUnlocked()
		{
			// A unique you have built is unlocked in the progression sense but
			// unbuildable in the only sense the player cares about.
			Assert.Equal(
				BuildingCatalogFacetSelection.Availability.AlreadyBuilt,
				BuildingCatalogQueryEngine.AvailabilityOf(Base with { IsLocked = false, IsAlreadyBuilt = true }));
		}

		[Fact]
		public void LockedWinsOverAlreadyBuilt()
		{
			// A locked unique cannot also be built, so when both read true the
			// data is wrong and Locked is the safer answer.
			Assert.Equal(
				BuildingCatalogFacetSelection.Availability.Locked,
				BuildingCatalogQueryEngine.AvailabilityOf(Base with { IsLocked = true, IsAlreadyBuilt = true }));
		}

		[Fact]
		public void EveryEntryLandsInExactlyOneState()
		{
			var plain = BuildingCatalogQueryEngine.AvailabilityOf(Base);
			Assert.Equal(BuildingCatalogFacetSelection.Availability.Unlocked, plain);
			Assert.Contains(plain, BuildingCatalogFacetSelection.Availability.All);
			Assert.Equal(3, BuildingCatalogFacetSelection.Availability.All.Count);
		}

		[Fact]
		public void ThePlacedSetTracksBothEdges()
		{
			// Both directions matter: building a unique takes it off the
			// buildable list, bulldozing it puts it back.
			var placedUniques = new PlacedUniques();
			Assert.False(placedUniques.IsAlreadyBuilt(42));

			placedUniques.Set(42, placed: true);
			Assert.True(placedUniques.IsAlreadyBuilt(42));

			placedUniques.Set(42, placed: false);
			Assert.False(placedUniques.IsAlreadyBuilt(42));
		}

		[Fact]
		public void ResetClearsThePreviousCity()
		{
			// A city load must not inherit the last one's uniques.
			var placedUniques = new PlacedUniques();
			placedUniques.Reset(new[] { 1, 2, 3 });
			Assert.Equal(3, placedUniques.Count);

			placedUniques.Reset(new[] { 9 });
			Assert.True(placedUniques.IsAlreadyBuilt(9));
			Assert.False(placedUniques.IsAlreadyBuilt(1));
		}

		[Fact]
		public void ResetSaysWhetherTheSetMoved()
		{
			// The catalog's snapshot cache is keyed on the index generation, so a
			// rescan that changes nothing must not bump it and throw the cache away.
			var placedUniques = new PlacedUniques();
			placedUniques.Reset(new[] { 1, 2 });

			Assert.False(placedUniques.Reset(new[] { 2, 1 }));
			Assert.True(placedUniques.Reset(new[] { 1 }));
			Assert.True(placedUniques.Reset(null));
			Assert.False(placedUniques.Reset(null));
		}
	}
}
