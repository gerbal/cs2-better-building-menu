using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What an Options row says while Replace the vanilla build menu is off.</summary>
	/// <remarks>See docs/design-notes.md, "Reset the build menu".</remarks>
	public static class OptionRows
	{
		/// <summary>The locale id of the line every other row reads while Replace is off.</summary>
		public const string OffWhileReplaceOffId = "Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.OffWhileReplaceOff]";

		/// <summary>The Width row's labels, one per step from the first: the game's size, then the two that cover the chirper.</summary>
		public static readonly IReadOnlyList<string> WidthStepLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.WidthStep1]",
			"Options.LABEL[BetterBuildingMenu.WidthStep2]",
			"Options.LABEL[BetterBuildingMenu.WidthStep3]",
			"Options.LABEL[BetterBuildingMenu.WidthStep4]",
			"Options.LABEL[BetterBuildingMenu.WidthStep5]",
		};

		/// <summary>The Default view row's labels, one per value of <see cref="BodyViews.DefaultViews"/>.</summary>
		public static readonly IReadOnlyList<string> DefaultViewLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.DefaultViewAuto]",
			"Options.LABEL[BetterBuildingMenu.DefaultViewList]",
			"Options.LABEL[BetterBuildingMenu.DefaultViewTiles]",
			"Options.LABEL[BetterBuildingMenu.DefaultViewCards]",
		};

		/// <summary>The At large text row's labels, one per value of <see cref="LargeText.Values"/>.</summary>
		public static readonly IReadOnlyList<string> AtLargeTextLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.AtLargeTextMoreBuildings]",
			"Options.LABEL[BetterBuildingMenu.AtLargeTextWholeNames]",
		};

		/// <summary>The What counts knob's labels, one per value of <see cref="Tuning.WhatCountsValues"/>.</summary>
		public static readonly IReadOnlyList<string> WhatCountsLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.WhatCountsCostOrCapacity]",
			"Options.LABEL[BetterBuildingMenu.WhatCountsCapacityOnly]",
		};

		/// <summary>The Auto at large text knob's labels, one per value of <see cref="Tuning.AutoLargeTextValues"/>.</summary>
		public static readonly IReadOnlyList<string> AutoLargeTextLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.AutoLargeTextLookOwn]",
			"Options.LABEL[BetterBuildingMenu.AutoLargeTextList]",
			"Options.LABEL[BetterBuildingMenu.AutoLargeTextTiles]",
		};

		/// <summary>The Cards from width knob's labels, one per value of <see cref="Tuning.CardsFromValues"/>.</summary>
		public static readonly IReadOnlyList<string> CardsFromLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.CardsFromNever]",
			"Options.LABEL[BetterBuildingMenu.CardsFrom2]",
			"Options.LABEL[BetterBuildingMenu.CardsFrom3]",
			"Options.LABEL[BetterBuildingMenu.CardsFrom4]",
			"Options.LABEL[BetterBuildingMenu.CardsFrom5]",
		};

		/// <summary>The Name lines knob's labels, one per value of <see cref="Tuning.NameLinesValues"/>.</summary>
		public static readonly IReadOnlyList<string> NameLinesLabelIds = new[]
		{
			"Options.LABEL[BetterBuildingMenu.NameLinesAuto]",
			"Options.LABEL[BetterBuildingMenu.NameLines1]",
			"Options.LABEL[BetterBuildingMenu.NameLines2]",
		};

		/// <summary>A row's description: its own while Replace is on, else the line saying why it is greyed out.</summary>
		public static string DescriptionId(bool replaceOn, string ownId) => replaceOn ? ownId : OffWhileReplaceOffId;

		/// <summary>The page and tab VIEW's More options opens: the mod's own page, and a tab the game names after it.</summary>
		public static (string Page, string Section) OptionsPage(string settingsId, string tab) => (settingsId, settingsId + "." + tab);
	}
}
