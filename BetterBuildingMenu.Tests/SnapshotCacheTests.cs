using System;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class SnapshotCacheTests
	{
		private static readonly BuildingCatalogEntry[] Some = Array.Empty<BuildingCatalogEntry>();

		[Fact]
		public void TheSameKeyAndGenerationHits()
		{
			var cache = new SnapshotCache();
			var key = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);

			cache.Put(key, 3, Some);

			Assert.True(cache.TryGet(key, 3, out var hit));
			Assert.Same(Some, hit);
		}

		[Fact]
		public void ADifferentKeyMisses()
		{
			var cache = new SnapshotCache();
			cache.Put(SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None), 3, Some);

			Assert.False(cache.TryGet(SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None), 3, out _));
			Assert.False(cache.TryGet(SnapshotKey.For("Roads", null, true, VanillaToolbarSelection.None), 3, out _));
			Assert.False(cache.TryGet(SnapshotKey.For("Roads", new[] { "1" }, false, VanillaToolbarSelection.None), 3, out _));
		}

		[Fact]
		public void ANewGenerationMissesAndEmptiesTheCache()
		{
			// A new generation means the index moved under every snapshot at once —
			// a re-index, an unlock, a unique built — so nothing cached is kept.
			var cache = new SnapshotCache();
			var roads = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);
			var zones = SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None);
			cache.Put(roads, 3, Some);
			cache.Put(zones, 3, Some);

			Assert.False(cache.TryGet(roads, 4, out _));
			Assert.Equal(0, cache.Count);
			Assert.False(cache.TryGet(zones, 4, out _));
		}

		[Fact]
		public void TheToolbarSelectionIsComparedByValue()
		{
			// VanillaToolbarSelection is a struct holding lists, so struct
			// equality would compare list references and every refresh would
			// miss. The key spells the lists out.
			var a = new VanillaToolbarSelection(new[] { 5, 9 }, new[] { 2 }, true, false);
			var b = new VanillaToolbarSelection(new[] { 5, 9 }, new[] { 2 }, true, false);
			var c = new VanillaToolbarSelection(new[] { 5, 9 }, new[] { 3 }, true, false);

			Assert.Equal(SnapshotKey.For("Roads", null, false, a), SnapshotKey.For("Roads", null, false, b));
			Assert.NotEqual(SnapshotKey.For("Roads", null, false, a), SnapshotKey.For("Roads", null, false, c));
		}
	}
}
