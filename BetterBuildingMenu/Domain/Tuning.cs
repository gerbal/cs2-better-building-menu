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

		/// <summary>The build menu follows the game's interface style as it ships.</summary>
		public const bool InterfaceStyles = true;

		/// <summary>The tabs say their names above the first Width step, where they all fit, as it ships.</summary>
		public const bool TabNames = true;

		/// <summary>The Auto rule draws a list where at least this share of a menu's rows, in percent, carry what counts.</summary>
		public const int ListShare = 50;

		/// <summary>The lowest share the knob offers, in percent.</summary>
		public const int ListShareMin = 30;

		/// <summary>The highest share the knob offers, in percent.</summary>
		public const int ListShareMax = 90;

		/// <summary>What the Auto rule counts: a cost or a capacity, as it ships, or a capacity only.</summary>
		public const string WhatCounts = CostOrCapacity;

		/// <summary>A row counts toward the list when it carries a cost or a capacity.</summary>
		public const string CostOrCapacity = "costOrCapacity";

		/// <summary>A row counts toward the list when it carries a capacity.</summary>
		public const string CapacityOnly = "capacityOnly";

		/// <summary>The What counts knob's values, in its order.</summary>
		public static readonly IReadOnlyList<string> WhatCountsValues = new[] { CostOrCapacity, CapacityOnly };

		/// <summary>At large text Roads and Parks keep the look's own body, as it ships, or show the list or the tiles.</summary>
		public const string AutoLargeText = LookOwn;

		/// <summary>The look's own body at large text: the Auto rule's choice stands.</summary>
		public const string LookOwn = "lookOwn";

		/// <summary>The Auto at large text knob's values, in its order.</summary>
		public static readonly IReadOnlyList<string> AutoLargeTextValues = new[] { LookOwn, BodyViews.List, BodyViews.Tiles };

		/// <summary>The Width step from which Auto draws Cards: never, as it ships, since cards hold fewer buildings than a screen of the list or the tiles at every width.</summary>
		public const int CardsFrom = 0;

		/// <summary>The Cards from width knob's values, in its order: never, then the steps that can show cards.</summary>
		public static readonly IReadOnlyList<int> CardsFromValues = new[] { CardsFrom, 2, 3, 4, 5 };

		/// <summary>The list's plate height at normal text size, in rem: with its lines and gaps it fills the game's own body height.</summary>
		public const float ListPlateHeight = 27.25f;

		/// <summary>The lowest plate height the knob offers, in rem.</summary>
		public const float ListPlateHeightMin = 23f;

		/// <summary>The highest plate height the knob offers, in rem.</summary>
		public const float ListPlateHeightMax = 34f;

		/// <summary>How many lines a list name takes: the look's own, as it ships, else one or two.</summary>
		public const int NameLines = 0;

		/// <summary>The Name lines knob's values, in its order.</summary>
		public static readonly IReadOnlyList<int> NameLinesValues = new[] { NameLines, 1, 2 };

		/// <summary>The Tiles view names the armed or pointed tile on a line under its rows, as it ships.</summary>
		public const bool TileNameLine = true;

		/// <summary>The slot margin's shipped value, in percent: a newcomer needs 1.25 times a holder's placements.</summary>
		public const int SlotMarginPercent = 25;

		/// <summary>The lowest slot margin the knob offers, in percent: a newcomer takes a slot at a tie.</summary>
		public const int SlotMarginMin = 0;

		/// <summary>The highest slot margin the knob offers, in percent.</summary>
		public const int SlotMarginMax = 50;

		/// <summary>A knob's value: the stored one in developer mode, the shipped one otherwise, whatever is stored.</summary>
		public static T Value<T>(bool developerMode, T stored, T shipped) => developerMode ? stored : shipped;

		/// <summary>A share a hand edit left outside the knob's range reads as the nearer end.</summary>
		public static int ListShareOf(int stored) => Math.Min(ListShareMax, Math.Max(ListShareMin, stored));

		/// <summary>A plate height outside the knob's range reads as the nearer end, and one that is no number as shipped.</summary>
		public static float ListPlateHeightOf(float stored) =>
			float.IsNaN(stored) || float.IsInfinity(stored) ? ListPlateHeight : Math.Min(ListPlateHeightMax, Math.Max(ListPlateHeightMin, stored));

		/// <summary>One of a knob's values, else its shipped one.</summary>
		public static T OneOf<T>(IReadOnlyList<T> values, T stored, T shipped) => values.Contains(stored) ? stored : shipped;
	}
}
