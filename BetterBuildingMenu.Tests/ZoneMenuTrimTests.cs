using System.Collections.Generic;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class ZoneMenuTrimTests
	{
		private static ZoneCatalogEntry Zone(int id) =>
			new(id, 1, $"Zone{id}", $"Zone {id}", "Residential", ZoneTypeFilter.Mixed, string.Empty);

		[Fact]
		public void KeepsOnlyWhatTheMenuPlaces()
		{
			// The ZoneData query also returns zones the player can never pick.
			var catalog = new List<ZoneCatalogEntry> { Zone(1), Zone(2), Zone(3) };

			Assert.True(ZoneMenuTrim.Apply(catalog, new HashSet<int> { 1, 3 }));
			Assert.Equal(new[] { 1, 3 }, catalog.Select(entry => entry.Id));
		}

		[Fact]
		public void LeavesTheCatalogWholeWhenTheWalkFoundNothing()
		{
			// An empty set means the walk cannot see the menu, not that the menu offers nothing.
			var catalog = new List<ZoneCatalogEntry> { Zone(1), Zone(2) };

			Assert.False(ZoneMenuTrim.Apply(catalog, new HashSet<int>()));
			Assert.Equal(new[] { 1, 2 }, catalog.Select(entry => entry.Id));
		}
	}
}
