namespace BetterBuildingMenu.Domain
{
	/// <summary>What shows when the pointer rests on a building: a card beside it, a wide card in the game's detail slot, or the readout alone.</summary>
	/// <remarks>The UI draws each form. See docs/design-notes.md, "The hover card".</remarks>
	public static class HoverCards
	{
		public const string Pointer = "pointer";

		public const string Slot = "slot";

		public const string Status = "status";

		/// <summary>The Hover card row's values, in its order.</summary>
		public static readonly IReadOnlyList<string> Values = new[] { Pointer, Slot, Status };

		/// <summary>One of the three, exactly; anything else reads as beside the pointer.</summary>
		public static string Sanitize(string? value) =>
			value is not null && Values.Contains(value) ? value : Pointer;
	}
}
