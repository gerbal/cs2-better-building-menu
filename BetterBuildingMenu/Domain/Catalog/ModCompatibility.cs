namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>Which of the mods the index adapts to were enabled when a full pass ran.</summary>
	/// <remarks>Read per full pass, not once per process: the game re-reads the playset at every city
	/// load, so a mod can join without a restart. See docs/indexing.md, "Load timing".</remarks>
	/// <param name="ExtraDetailing">Extra Detailing Tools, whose lanes the lanes processor lists.</param>
	/// <param name="RoadBuilder">Road Builder, whose discarded roads the pass drops.</param>
	public sealed record ModCompatibility(bool ExtraDetailing, bool RoadBuilder)
	{
		/// <summary>Neither, as before the first pass.</summary>
		public static ModCompatibility None { get; } = new(false, false);
	}
}
