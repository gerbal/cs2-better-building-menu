namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Which menus open on All rather than on a tab: a menu whose view is Cards, its cards under their
	/// tabs' labels; and a small menu, whose rows all fit one screen, which the UI names, since which body
	/// a menu draws is the UI's rule.
	/// </summary>
	/// <remarks>See docs/design-notes.md, "Opening on the building's tab".</remarks>
	public static class OpensOnAll
	{
		/// <summary>The UI's set of small menus, one name a line; a blank line names nothing.</summary>
		public static IReadOnlyCollection<string> Parse(string? joined) =>
			new HashSet<string>(
				(joined ?? string.Empty).Split('\n').Select(name => name.Trim()).Where(name => name.Length > 0),
				StringComparer.Ordinal);

		/// <summary>Whether a menu opens on All: the UI names it, or its view is Cards, by its own pick or by Default view.</summary>
		/// <remarks>In developer mode an icons-with-names pick is the menu's own, as the UI reads it.</remarks>
		public static bool For(string? menu, IReadOnlyCollection<string> small, string? menuViews, string? defaultView, bool developerMode = false)
		{
			if (string.IsNullOrWhiteSpace(menu))
			{
				return false;
			}

			var pick = BodyViews.SanitizePick(MenuPicks.Get(menuViews, menu), developerMode);

			return small.Contains(menu!)
				|| pick == BodyViews.Cards
				|| (pick.Length == 0 && BodyViews.SanitizeDefault(defaultView) == BodyViews.Cards);
		}
	}
}
