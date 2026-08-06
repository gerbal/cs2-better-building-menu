using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Pure state transitions for the Building Lens compare tray.
	/// </summary>
	/// <remarks>
	/// The tray lives in the backend rather than in React state because the
	/// panel unmounts on close, on the Catalog/Tools switch, and when the game
	/// closes it on entering a placement tool. A client-owned shortlist was
	/// therefore destroyed by the very flow it exists to serve: pick three
	/// candidates, place one, come back to an empty tray — while the search and
	/// filters, which are backend-owned, survived. Holding ids (not projected
	/// entries) keeps this list cheap and lets the projection refresh with the
	/// prefab index.
	/// </remarks>
	public static class BuildingCatalogCompareSelection
	{
		/// <summary>
		/// Mirrors <c>MAX_COMPARE_ENTRIES</c> in
		/// <c>UI/src/domain/buildingCatalogContracts.ts</c>, which the tray
		/// renders as the denominator of its "n / max" counter.
		/// </summary>
		public const int MaxEntries = 3;

		public static IReadOnlyList<int> Toggle(IReadOnlyList<int>? current, int id)
		{
			var selection = current is null ? new List<int>() : current.ToList();

			if (selection.Remove(id))
			{
				return selection;
			}

			if (selection.Count >= MaxEntries)
			{
				return selection;
			}

			selection.Add(id);

			return selection;
		}

		public static IReadOnlyList<int> Clear()
		{
			return Array.Empty<int>();
		}
	}
}
