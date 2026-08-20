using Colossal.UI.Binding;

namespace FindItBuildingMenu.Domain
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
	public sealed record MenuBranchCount(string Id, int Count, string Icon) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("count");
			writer.Write(Count);
			writer.PropertyName("icon");
			writer.Write(Icon ?? string.Empty);
			writer.TypeEnd();
		}
	}
}
