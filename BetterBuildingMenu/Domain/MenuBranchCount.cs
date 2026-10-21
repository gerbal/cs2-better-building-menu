using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One tab of the menu's development-tree strip: the branch, its size, and
	/// the icon the game's own dev tree draws for it.
	/// </summary>
	/// <remarks>
	/// The icon rides with the count rather than in a table of its own: branches are
	/// per-service, arrive with their counts and change with the menu, so a second
	/// binding keyed by branch name would be the same data with room to disagree.
	/// </remarks>
	/// <param name="Label">
	/// What the tab says, when that differs from what it MATCHES on. Empty for a
	/// development branch, whose name is unique; a density tab matches on a composite
	/// carrying its family (<see cref="StripAxes.DensityTab"/>) and shows only the tier;
	/// a school tier matches on its level and shows the game's name for it.
	/// </param>
	public sealed record MenuBranchCount(string Id, int Count, string Icon, string Label = "") : IJsonWritable
	{
		/// <summary>What to draw. Falls back to the match key.</summary>
		public string DisplayLabel => string.IsNullOrEmpty(Label) ? Id : Label;

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("id", Id);
			writer.Prop("count", Count);
			writer.Prop("icon", Icon ?? string.Empty);
			writer.Prop("label", DisplayLabel);
			writer.TypeEnd();
		}
	}
}
