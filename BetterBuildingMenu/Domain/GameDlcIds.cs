namespace BetterBuildingMenu.Domain
{
	/// <summary>The two DlcId values the catalog compares against, as constants.</summary>
	/// <remarks>
	/// Reading DlcId.Invalid or DlcId.BaseGame runs DlcId's type initializer, which CI's
	/// mock assemblies replace with a throw. GameDlcIdsTests pins these to the game's values.
	/// </remarks>
	public static class GameDlcIds
	{
		public const int Invalid = -1;
		public const int BaseGame = -2009;
	}
}
