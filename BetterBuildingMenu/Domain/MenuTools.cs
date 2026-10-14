namespace BetterBuildingMenu.Domain
{
	/// <summary>Which tools close the build menu when they take over.</summary>
	/// <remarks>See docs/design-notes.md, "Tools that take the screen".</remarks>
	public static class MenuTools
	{
		/// <summary>Whether a tool brings a screen of its own, so the build menu goes.</summary>
		public static bool TakesTheScreen(string? toolId) => toolId is "RoadBuilderTool" or "MoveItTool";
	}
}
