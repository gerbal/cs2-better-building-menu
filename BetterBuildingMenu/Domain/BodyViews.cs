namespace BetterBuildingMenu.Domain
{
	/// <summary>The bodies a menu draws, as the Default view row and each menu's own VIEW pick store them.</summary>
	/// <remarks>
	/// Stored as strings, so a body a later release retires can be read as another. The UI's copy of
	/// the kinds is domain/bodyChoice.ts. See docs/design-notes.md, "The bodies".
	/// </remarks>
	public static class BodyViews
	{
		/// <summary>The look's own rule picks the body, per menu.</summary>
		public const string Auto = "auto";

		public const string List = "list";

		public const string Icons = "icons";

		public const string Tiles = "tiles";

		/// <summary>0.2.4's card, which only a pick shows: Auto never does.</summary>
		public const string Cards = "cards";

		/// <summary>The icons with each name under its picture: a developer's pick, for the timed check against the icons.</summary>
		public const string IconsNamed = "iconsNamed";

		/// <summary>What a menu's own pick can be.</summary>
		public static readonly IReadOnlyList<string> Kinds = new[] { List, Icons, Tiles, Cards };

		/// <summary>The Default view row's values, in its order: Auto, then each body this release draws.</summary>
		public static readonly IReadOnlyList<string> DefaultViews = new[] { Auto, List, Icons, Tiles, Cards };

		/// <summary>A menu's own pick: one of the kinds, exactly, or in developer mode the icons with names; else "" for none.</summary>
		/// <remarks>A stored icons-with-names pick reads as none outside developer mode, so a player never meets it.</remarks>
		public static string SanitizePick(string? value, bool developerMode = false) =>
			value is not null && (Kinds.Contains(value) || (developerMode && value == IconsNamed)) ? value : MenuPicks.None;

		/// <summary>Each menu's own VIEW as the UI reads it: the stored picks, less any that reads as none.</summary>
		public static MenuPick[] PicksOf(string? stored, bool developerMode = false) =>
			MenuPicks.Parse(stored).Where(pick => SanitizePick(pick.Value, developerMode).Length > 0).ToArray();

		/// <summary>One of the Default view row's values, exactly; anything else reads as Auto.</summary>
		public static string SanitizeDefault(string? value) =>
			value is not null && DefaultViews.Contains(value) ? value : Auto;

		/// <summary>
		/// The body 0.2.5's remembered view becomes: Cards stays Cards, Grid draws as Tiles, List and
		/// Table as List. Null when nothing is remembered.
		/// </summary>
		public static string? FromRemembered(string? viewMode) => viewMode switch
		{
			"cards" => Cards,
			"grid" => Tiles,
			"list" or "table" => List,
			_ => null,
		};
	}
}
