namespace BetterBuildingMenu.Domain
{
	/// <summary>The view 0.2.5 kept, which only the settings migration reads, once, into Default view.</summary>
	/// <remarks>
	/// The kinds are 0.2.5's four views, as it spelled them. See docs/design-notes.md, "The remembered view".
	/// </remarks>
	public static class AssetMenuViewMode
	{
		/// <summary>No pick yet: the UI opens in its default view.</summary>
		public const string None = "";

		public static readonly IReadOnlyList<string> Kinds = new[] { "grid", "list", "cards", "table" };

		/// <summary>One of the four kinds, exactly, or <see cref="None"/>.</summary>
		public static string Sanitize(string? value) =>
			value is not null && Kinds.Contains(value) ? value : None;
	}
}
