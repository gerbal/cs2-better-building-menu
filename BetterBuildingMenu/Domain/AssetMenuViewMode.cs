namespace BetterBuildingMenu.Domain
{
	/// <summary>The view the player last picked in the control pane, kept across sessions.</summary>
	/// <remarks>
	/// The kinds are the UI's (GroupedResults.tsx, CatalogViewMode), spelled as it spells
	/// them. See docs/design-notes.md, "The remembered view".
	/// </remarks>
	public static class AssetMenuViewMode
	{
		/// <summary>No pick yet: the UI opens in its default view.</summary>
		public const string None = "";

		public static readonly IReadOnlyList<string> Kinds = new[] { "grid", "list", "cards", "table" };

		/// <summary>One of the four kinds, exactly, or <see cref="None"/>.</summary>
		public static string Sanitize(string? value) =>
			value is "grid" or "list" or "cards" or "table" ? value : None;

		/// <summary>Whether a pick changes what the settings file holds, which is when it is saved.</summary>
		public static bool ShouldSave(string stored, string picked) =>
			!string.Equals(stored, Sanitize(picked), StringComparison.Ordinal);
	}
}
