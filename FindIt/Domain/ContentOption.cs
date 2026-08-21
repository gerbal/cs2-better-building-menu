namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// How one option in the Content facet says which mechanism owns it.
	/// </summary>
	/// <remarks>
	/// The facet is one axis over three different pieces of state — the game's
	/// pack selection, the game's Vanilla toggle, and our own DlcIds — because
	/// no single one of them reaches all the content. The prefix is how the
	/// click gets routed back to the right owner without the UI having to know
	/// anything about packs or DLC.
	///
	/// Kept beside the query rather than in the adapter so the UI's router and
	/// the C# toggle agree on the spelling by construction.
	/// </remarks>
	public static class ContentOption
	{
		/// <summary>Base game: writes the game's Vanilla toggle.</summary>
		public const string Vanilla = "vanilla";

		/// <summary>Prefix for a creator pack, then "index:version".</summary>
		public const string Pack = "pack:";

		/// <summary>Prefix for a DLC that ships no pack, then its numeric id.</summary>
		public const string Dlc = "dlc:";

		/// <summary>The DLC id behind a <see cref="Dlc"/> option, or empty.</summary>
		public static string DlcIdOf(string optionId) =>
			optionId is not null && optionId.StartsWith(Dlc, System.StringComparison.Ordinal)
				? optionId.Substring(Dlc.Length)
				: string.Empty;
	}
}
