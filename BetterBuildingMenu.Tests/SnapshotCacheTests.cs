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
		public void TheSameKeyAndContentHitsWithTheGenerationItWasStampedWith()
		{
			var cache = new SnapshotCache();
			var key = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);

			cache.Put(key, 3, 7, Some);

			Assert.True(cache.TryGet(key, 3, out var hit, out var generation));
			Assert.Same(Some, hit);
			Assert.Equal(7, generation);
		}

		[Fact]
		public void ADifferentKeyMisses()
		{
			var cache = new SnapshotCache();
			cache.Put(SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None), 3, 3, Some);

			Assert.False(cache.TryGet(SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None), 3, out _, out _));
			Assert.False(cache.TryGet(SnapshotKey.For("Roads", null, true, VanillaToolbarSelection.None), 3, out _, out _));
			Assert.False(cache.TryGet(SnapshotKey.For("Roads", new[] { "1" }, false, VanillaToolbarSelection.None), 3, out _, out _));
		}

		[Fact]
		public void NewContentMissesAndEmptiesTheCache()
		{
			// New content means the index moved under every snapshot at once — a pass, or a
			// load emptying it — so nothing cached is kept.
			var cache = new SnapshotCache();
			var roads = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);
			var zones = SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None);
			cache.Put(roads, 3, 3, Some);
			cache.Put(zones, 3, 3, Some);

			Assert.False(cache.TryGet(roads, 4, out _, out _));
			Assert.Equal(0, cache.Count);
			Assert.False(cache.TryGet(zones, 4, out _, out _));
		}

		[Fact]
		public void ARestampedSnapshotKeepsTheOthers()
		{
			// An unlock or a placed unique only brings one snapshot's rows up to date as it is read.
			var cache = new SnapshotCache();
			var roads = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);
			var zones = SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None);
			cache.Put(roads, 3, 5, Some);
			cache.Put(zones, 3, 5, Some);

			cache.Put(roads, 3, 6, Some);

			Assert.Equal(2, cache.Count);
			Assert.True(cache.TryGet(zones, 3, out _, out var generation));
			Assert.Equal(5, generation);
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
