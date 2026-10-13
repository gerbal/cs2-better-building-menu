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

		/// <summary>A row's description: its own while Replace is on, else the line saying why it is greyed out.</summary>
		public static string DescriptionId(bool replaceOn, string ownId) => replaceOn ? ownId : OffWhileReplaceOffId;
	}
}
