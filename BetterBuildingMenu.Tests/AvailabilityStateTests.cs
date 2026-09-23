using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The three availability states, and that they partition.
	/// </summary>
	public class AvailabilityStateTests : IDisposable
	{
		// The registry is process-wide. Empty is how every test finds it, since nothing in a
		// test run loads a city, so Dispose empties it again, pass or fail.
		public void Dispose() => PlacedUniqueRegistry.Reset(Array.Empty<int>());

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
			Assert.Equal(3, BuildingCatalogFacetSelection.Availability.All.Length);
		}

		[Fact]
		public void TheRegistryTracksBothEdges()
		{
			// Both directions matter: building a unique takes it off the
			// buildable list, bulldozing it puts it back.
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
		}

		[Fact]
		public void ResetSaysWhetherTheSetMoved()
		{
			// The catalog's snapshot cache is keyed on the index generation, so a
			// rescan that changes nothing must not bump it and throw the cache away.
			PlacedUniqueRegistry.Reset(new[] { 1, 2 });

			Assert.False(PlacedUniqueRegistry.Reset(new[] { 2, 1 }));
			Assert.True(PlacedUniqueRegistry.Reset(new[] { 1 }));
			Assert.True(PlacedUniqueRegistry.Reset(null));
			Assert.False(PlacedUniqueRegistry.Reset(null));
		}
	}
}
