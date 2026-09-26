namespace BetterBuildingMenu.Domain
{
	/// <summary>The two DlcId values the catalog compares against, as constants.</summary>
	/// <remarks>
	/// Constants, so a default parameter or a pattern can use them; the game's are static
	/// fields. GameDlcIdsTests pins these to the game's values.
	/// </remarks>
	public static class GameDlcIds
	{
		public const int Invalid = -1;
		public const int BaseGame = -2009;
	}
}
