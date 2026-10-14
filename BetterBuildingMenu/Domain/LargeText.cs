namespace BetterBuildingMenu.Domain
{
	/// <summary>What the list does above 100% text: more buildings with long names shortened, or fewer with every name whole.</summary>
	/// <remarks>Each look maps the two to its own forms. See docs/design-notes.md, "The bodies".</remarks>
	public static class LargeText
	{
		public const string MoreBuildings = "moreBuildings";

		public const string WholeNames = "wholeNames";

		/// <summary>The At large text row's values, in its order.</summary>
		public static readonly IReadOnlyList<string> Values = new[] { MoreBuildings, WholeNames };

		/// <summary>One of the two, exactly; anything else reads as More buildings.</summary>
		public static string Sanitize(string? value) =>
			value is not null && Values.Contains(value) ? value : MoreBuildings;
	}
}
