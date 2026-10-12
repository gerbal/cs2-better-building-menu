namespace BetterBuildingMenu.Domain
{
	/// <summary>The developer knobs' shipped values, and the one rule that reads any knob.</summary>
	/// <remarks>
	/// A knob's row shows only in the game's developer mode, and its stored value counts only
	/// there, so a value left from tuning does nothing in a normal run. See
	/// docs/design-notes.md, "Developer knobs".
	/// </remarks>
	public static class Tuning
	{
		/// <summary>The pick logger ships off.</summary>
		public const bool PickLogger = false;

		/// <summary>The slot margin's shipped value, in percent: a newcomer needs 1.25 times a holder's placements.</summary>
		public const int SlotMarginPercent = 25;

		/// <summary>The lowest slot margin the knob offers, in percent: a newcomer takes a slot at a tie.</summary>
		public const int SlotMarginMin = 0;

		/// <summary>The highest slot margin the knob offers, in percent.</summary>
		public const int SlotMarginMax = 50;

		/// <summary>A knob's value: the stored one in developer mode, the shipped one otherwise, whatever is stored.</summary>
		public static T Value<T>(bool developerMode, T stored, T shipped) => developerMode ? stored : shipped;
	}
}
