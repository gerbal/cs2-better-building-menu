using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The three availability states, and that they still partition.
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
			IsUniqueMesh: false,
			IsVanilla: true,
			PdxModsId: "");

		[Fact]
		public void AlreadyBuiltSupersedesUnlocked()
		{
			// A unique you have built is unlocked in the progression sense and
			// unbuildable in the only sense the player cares about. Reporting it
			// as Unlocked put it in the list of things to build.
			Assert.Equal(
				BuildingCatalogFacetSelection.Availability.AlreadyBuilt,
				BuildingCatalogQueryEngine.AvailabilityOf(Base with { IsLocked = false, IsAlreadyBuilt = true }));
		}

		[Fact]
		public void LockedWinsOverAlreadyBuilt()
		{
			// Ordering matters or the states stop partitioning. A locked unique
			// cannot have been built, so if both ever read true the data is
			// wrong and Locked is the safer thing to say.
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
			Assert.Equal(3, BuildingCatalogFacetSelection.Availability.All.Length);
		}

		[Fact]
		public void TheRegistryTracksBothEdges()
		{
			// Both directions matter: build the Space Center and it leaves the
			// buildable list; bulldoze it and it comes back. A one-way set would
			// be wrong the first time a player demolished something.
			PlacedUniqueRegistry.Reset(null);
			Assert.False(PlacedUniqueRegistry.IsAlreadyBuilt(42));

			PlacedUniqueRegistry.Set(42, placed: true);
			Assert.True(PlacedUniqueRegistry.IsAlreadyBuilt(42));

			PlacedUniqueRegistry.Set(42, placed: false);
			Assert.False(PlacedUniqueRegistry.IsAlreadyBuilt(42));
		}

		[Fact]
		public void ResetClearsThePreviousCity()
		{
			// A city load must not inherit the last one's uniques.
			PlacedUniqueRegistry.Reset(new[] { 1, 2, 3 });
			Assert.Equal(3, PlacedUniqueRegistry.Count);

			PlacedUniqueRegistry.Reset(new[] { 9 });
			Assert.True(PlacedUniqueRegistry.IsAlreadyBuilt(9));
			Assert.False(PlacedUniqueRegistry.IsAlreadyBuilt(1));

			PlacedUniqueRegistry.Reset(null);
		}
	}
}
