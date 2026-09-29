namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Decides when selecting something on the map closes the menu the asset menu stands in for.
	/// </summary>
	/// <remarks>
	/// The game draws the selected-info panel only while no toolbar menu is selected. Vanilla
	/// never meets the case, because opening a menu arms a tool and a click places rather than
	/// selects. The asset menu opens a menu with nothing armed, so the default tool selects, and the
	/// selection's panel stayed hidden behind the open menu: the click seemed to do nothing.
	/// Handing the screen to the selection, as the menu's own close does, shows it.
	/// </remarks>
	public static class SelectionHandOff
	{
		public static bool ShouldCloseMenu(bool selectionChanged, bool somethingSelected, bool assetMenuOpen, bool ownsMenu) =>
			// A change, not a standing selection: opening a menu over a selection kept from
			// before must not shut it again at once.
			selectionChanged
			// Clearing a selection leaves nothing to show.
			&& somethingSelected
			&& assetMenuOpen
			// An asset menu not standing in for a menu leaves the toolbar unselected, so the panel
			// already shows.
			&& ownsMenu;
	}
}
