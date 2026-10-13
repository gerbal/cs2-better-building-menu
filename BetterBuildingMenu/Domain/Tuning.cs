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

		/// <summary>A label in a body takes one slot in line with the buildings, as it ships, or a line of its own.</summary>
		public const string BlockLabels = Inline;

		/// <summary>A label takes one slot, in line with the buildings around it.</summary>
		public const string Inline = "inline";

		/// <summary>A label starts a line and takes the whole of it, so no line holds two blocks.</summary>
		public const string OwnLine = "ownLine";

		/// <summary>The Block labels knob's values, in its order.</summary>
		public static readonly IReadOnlyList<string> BlockLabelsValues = new[] { Inline, OwnLine };

		/// <summary>A card's height at 100% text, in rem: three rows in the game's own body height, as it ships.</summary>
		public const int CardHeight = 46;

		/// <summary>The Card height knob's values, in its order: three rows, then two.</summary>
		public static readonly IReadOnlyList<int> CardHeightValues = new[] { CardHeight, 50 };

		/// <summary>A list whose menu holds few enough rows grows its plates into the lines they leave, as it ships.</summary>
		public const bool SmallMenusGrow = true;

		/// <summary>Search results at a wider Width step fill the columns under the field first, as it ships, or run along each row.</summary>
		public const string SearchFlow = NearField;

		/// <summary>The first screen's results fill the first step's columns, under the field, then the columns a wider step adds.</summary>
		public const string NearField = "nearField";

		/// <summary>Results run along each whole row, left to right, then down.</summary>
		public const string RowOrder = "rowOrder";

		/// <summary>The Search flow knob's values, in its order.</summary>
		public static readonly IReadOnlyList<string> SearchFlowValues = new[] { NearField, RowOrder };

		/// <summary>The share of a view's unlocked rows, in percent, that one value must hold for the readout to say it once, as it ships: two thirds.</summary>
		public const int SaidOnceAt = 67;

		/// <summary>The Said once at knob's values, in its order: as it ships, off, then the other shares.</summary>
		public static readonly IReadOnlyList<int> SaidOnceAtValues = new[] { SaidOnceAt, 0, 50, 60, 75, 80, 90 };

		/// <summary>A search result's name draws the typed word as the rest of it, as it ships, or dims it.</summary>
		public const bool DimTypedWord = false;

		/// <summary>Auto draws icons for a menu holding more rows than this where too few carry a cost or a capacity, as it ships.</summary>
		public const int IconsAbove = 200;

		/// <summary>The fewest rows the Icons above knob offers.</summary>
		public const int IconsAboveMin = 100;

		/// <summary>The most rows the Icons above knob offers.</summary>
		public const int IconsAboveMax = 2000;

		/// <summary>An icon's side in the Icons view at 100% text, in rem, as it ships: three lines of them in the game's own body.</summary>
		public const int IconSize = 44;

		/// <summary>The smallest icon the knob offers, in rem.</summary>
		public const int IconSizeMin = 36;

		/// <summary>The largest icon the knob offers, in rem.</summary>
		public const int IconSizeMax = 56;

		/// <summary>How long the pointer rests on a building before its hover card shows, in milliseconds, as it ships.</summary>
		public const int HoverDelay = 150;

		/// <summary>The shortest delay the knob offers: the card shows at once.</summary>
		public const int HoverDelayMin = 0;

		/// <summary>The longest delay the knob offers, in milliseconds.</summary>
		public const int HoverDelayMax = 500;

		/// <summary>The slot margin's shipped value, in percent: a newcomer needs 1.25 times a holder's placements.</summary>
		public const int SlotMarginPercent = 25;

		/// <summary>The lowest slot margin the knob offers, in percent: a newcomer takes a slot at a tie.</summary>
		public const int SlotMarginMin = 0;

		/// <summary>The highest slot margin the knob offers, in percent.</summary>
		public const int SlotMarginMax = 50;

		/// <summary>A knob's value: the stored one in developer mode, the shipped one otherwise, whatever is stored.</summary>
		public static T Value<T>(bool developerMode, T stored, T shipped) => developerMode ? stored : shipped;

		/// <summary>A share a hand edit left outside the knob's range reads as the nearer end.</summary>
		public static int ListShareOf(int stored) => Within(stored, ListShareMin, ListShareMax);

		/// <summary>A slider knob's value: one a hand edit left outside the knob's range reads as the nearer end.</summary>
		public static int Within(int stored, int min, int max) => Math.Min(max, Math.Max(min, stored));

		/// <summary>A plate height outside the knob's range reads as the nearer end, and one that is no number as shipped.</summary>
		public static float ListPlateHeightOf(float stored) =>
			float.IsNaN(stored) || float.IsInfinity(stored) ? ListPlateHeight : Math.Min(ListPlateHeightMax, Math.Max(ListPlateHeightMin, stored));

		/// <summary>One of a knob's values, else its shipped one.</summary>
		public static T OneOf<T>(IReadOnlyList<T> values, T stored, T shipped) => values.Contains(stored) ? stored : shipped;
	}
}
