namespace BetterBuildingMenu.Domain
{
	/// <summary>How the build menu's top edge settles when dragged: on whole lines of the open body, or where the pointer lets go.</summary>
	/// <remarks>The UI draws the drag. See docs/design-notes.md, "The top edge".</remarks>
	public static class TopEdges
	{
		public const string Whole = "whole";

		public const string Free = "free";

		/// <summary>The Top edge row's values, in its order.</summary>
		public static readonly IReadOnlyList<string> Values = new[] { Whole, Free };

		/// <summary>One of the two, exactly; anything else reads as whole lines.</summary>
		public static string Sanitize(string? value) =>
			value is not null && Values.Contains(value) ? value : Whole;
	}
}
