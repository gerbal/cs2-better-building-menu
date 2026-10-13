namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Each menu's share as counted so far, one per menu, kept with the index generation it was counted
	/// on. A menu is counted when it is open, once per generation, so a change to the index costs one
	/// menu's count, never every menu's.
	/// </summary>
	/// <remarks>See docs/design-notes.md, "The bodies".</remarks>
	public sealed class MenuShareLedger
	{
		private readonly List<MenuShare> _shares = new();
		private readonly Dictionary<string, int> _countedOn = new(StringComparer.Ordinal);

		/// <summary>Every menu counted so far, in the order each was first counted.</summary>
		public MenuShare[] Shares => _shares.ToArray();

		/// <summary>
		/// Counts the menu's share from its rows unless it was counted on this generation; true when it
		/// counted. The rows are read only when it counts, and a throw while reading them leaves the
		/// ledger as it was, so the next call counts again.
		/// </summary>
		public bool Count(string menu, int generation, Func<IEnumerable<BuildingCatalogEntry>> rows)
		{
			if (menu.Length == 0 || (_countedOn.TryGetValue(menu, out var counted) && counted == generation))
			{
				return false;
			}

			var share = MenuShare.Of(menu, rows());
			var at = _shares.FindIndex(kept => string.Equals(kept.Menu, menu, StringComparison.Ordinal));

			if (at >= 0)
			{
				_shares[at] = share;
			}
			else
			{
				_shares.Add(share);
			}

			_countedOn[menu] = generation;

			return true;
		}
	}
}
