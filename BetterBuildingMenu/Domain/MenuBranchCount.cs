using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One tab of the menu's development-tree strip: the branch, its size, and
	/// the icon the game's own dev tree draws for it.
	/// </summary>
	/// <remarks>
	/// The icon rides with the count rather than in a table of its own, unlike
	/// the milestone images. Milestones are ~20 shared ordinals, so a dense
	/// by-index table is published once and joined by every consumer; branches
	/// are per-service, arrive with their counts, and change with the menu — so
	/// a second binding keyed by branch name would be the same data with an
	/// extra chance to disagree.
	/// </remarks>
	/// <param name="Label">
	/// What the tab says, when that differs from what it MATCHES on.
	/// </param>
	/// <remarks>
	/// Empty for a development branch, whose name is unique across the menu and
	/// so can be both at once. Density tabs cannot: "Low Density" exists under
	/// Residential, Commercial and Office, and a tab click deliberately clears
	/// the category — see SetBuildingLensStripTab, "a branch and a category are
	/// ALTERNATIVES" — so a bare tier would narrow to every family's low
	/// density at once, while the count above it promised one family's.
	///
	/// So a density tab matches on a composite carrying its family and shows
	/// only the tier. See <see cref="StripAxes.DensityTab"/>.
	/// </remarks>
	public sealed record MenuBranchCount(string Id, int Count, string Icon, string Label = "") : IJsonWritable
	{
		/// <summary>What to draw. Falls back to the match key.</summary>
		public string DisplayLabel => string.IsNullOrEmpty(Label) ? Id : Label;

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("count");
			writer.Write(Count);
			writer.PropertyName("icon");
			writer.Write(Icon ?? string.Empty);
			writer.PropertyName("label");
			writer.Write(DisplayLabel);
			writer.TypeEnd();
		}
	}
}
