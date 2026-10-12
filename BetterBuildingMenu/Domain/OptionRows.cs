namespace BetterBuildingMenu.Domain
{
	/// <summary>What an Options row says while Replace the vanilla build menu is off.</summary>
	/// <remarks>See docs/design-notes.md, "Reset the build menu".</remarks>
	public static class OptionRows
	{
		/// <summary>The locale id of the line every other row reads while Replace is off.</summary>
		public const string OffWhileReplaceOffId = "Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.OffWhileReplaceOff]";

		/// <summary>A row's description: its own while Replace is on, else the line saying why it is greyed out.</summary>
		public static string DescriptionId(bool replaceOn, string ownId) => replaceOn ? ownId : OffWhileReplaceOffId;
	}
}
