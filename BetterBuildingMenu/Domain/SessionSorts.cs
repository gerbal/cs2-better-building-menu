namespace BetterBuildingMenu.Domain
{
	/// <summary>Each menu's sort this session, which its next open brings back; every launch starts each at the game's own order.</summary>
	/// <remarks>
	/// A sort picked while a query is typed is the search's, and is not kept, nor is Match, which only a
	/// query gives meaning. A menu is keyed by its trimmed name, as the state holds it. See
	/// docs/design-notes.md, "Each menu's own view and group".
	/// </remarks>
	public sealed class SessionSorts
	{
		private readonly Dictionary<string, (string Column, bool Descending)> _sorts = new(StringComparer.Ordinal);

		/// <summary>Keeps the open menu's sort, unless a query is typed or no menu is open.</summary>
		public void Keep(AssetMenuState state)
		{
			if (state.Menu.Length == 0 || !string.IsNullOrWhiteSpace(state.Query.SearchText))
			{
				return;
			}

			var column = state.Query.EffectiveSortColumn;
			_sorts[state.Menu] = string.Equals(column, BuildingCatalogQuery.MatchSort, StringComparison.OrdinalIgnoreCase)
				? (BuildingCatalogQuery.DefaultSort, false)
				: (column, state.Query.Descending);
		}

		/// <summary>What a menu opens with: its own GROUP, from the settings, and its sort this session, or the game's own order.</summary>
		public MenuMemory For(string? menu, string groupBy) =>
			menu is not null && _sorts.TryGetValue(menu.Trim(), out var sort)
				? new MenuMemory(groupBy, sort.Column, sort.Descending)
				: MenuMemory.Defaults with { GroupBy = groupBy };
	}
}
