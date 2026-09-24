using BetterBuildingMenu.Domain;

using System.Collections.Generic;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class PlacedUniqueScanTests
	{
		private static PlacedUniqueScan.Candidate Unique(int id, bool placed) => new(id, isUnique: true, accessorSaysPlaced: placed);

		[Fact]
		public void KeepsAUniqueTheGameCallsPlaced()
		{
			Assert.Equal(new[] { 42 }, PlacedUniqueScan.Collect(new[] { Unique(42, placed: true) }));
		}

		[Fact]
		public void DropsAUniqueTheGameCallsUnplaced()
		{
			// Anarchy's "place multiple unique buildings" option makes the game's own
			// accessor answer false for a signature building the city already holds.
			// Our panel has to follow it, or it refuses what the vanilla menu allows.
			Assert.Empty(PlacedUniqueScan.Collect(new[] { Unique(42, placed: false) }));
		}

		[Fact]
		public void IgnoresPrefabsThatAreNotUnique()
		{
			Assert.Empty(PlacedUniqueScan.Collect(new[]
			{
				new PlacedUniqueScan.Candidate(7, isUnique: false, accessorSaysPlaced: true),
			}));
		}

		[Fact]
		public void ReturnsEmptyForNothingToScan()
		{
			Assert.Empty(PlacedUniqueScan.Collect(new List<PlacedUniqueScan.Candidate>()));
			Assert.Empty(PlacedUniqueScan.Collect(null));
		}

		[Fact]
		public void ReportsEachPlacedUniqueOnce()
		{
			// Two prefab entries can share a prefab index; the placed set holds each once,
			// and the scan must not pretend the city holds two of the same asset.
			var placed = PlacedUniqueScan.Collect(new[] { Unique(42, true), Unique(42, true), Unique(9, true) });

			Assert.Equal(new[] { 9, 42 }, placed.OrderBy(id => id));
		}
	}
}
