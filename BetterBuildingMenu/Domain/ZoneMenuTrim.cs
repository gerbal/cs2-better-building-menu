using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Keeps the zone catalog to what the game's Zones menu offers.</summary>
	/// <remarks>
	/// The ZoneData query returns every zone prefab that exists, including ones the player can
	/// never pick, so the menu decides. A walk that sees nothing under Zones decides nothing:
	/// the catalog stays whole, since an over-broad catalog beats an empty one.
	/// </remarks>
	public static class ZoneMenuTrim
	{
		/// <summary>Drops every entry the Zones menu does not place, once the menu is found.</summary>
		/// <param name="placedInZones">The entity index of everything the walk found under Zones.</param>
		/// <returns>Whether there is a menu to trim to, and so whether the catalog is trimmed.</returns>
		public static bool Apply(List<ZoneCatalogEntry> catalog, HashSet<int> placedInZones)
		{
			if (placedInZones.Count == 0)
			{
				return false;
			}

			catalog.RemoveAll(entry => !placedInZones.Contains(entry.Id));

			return true;
		}
	}
}
