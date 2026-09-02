using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// How many assets sit behind one tab of the menu's category strip.
	/// </summary>
	/// <remarks>
	/// A sidecar to <see cref="VanillaMenuCategory"/> rather than a field on it.
	/// The category tree is the game's and does not move; the count is a
	/// property of the current query — the menu, the search, the facets — and
	/// changes on every keystroke. Putting it on the record would republish the
	/// whole tree to say one number changed.
	///
	/// Why it exists: Landscaping is 379 assets across 14 categories, and the
	/// strip drew 14 icon-only squares with nothing to distinguish them but a
	/// glyph. The "All" tab showed the first 100, which covered 7 of the 14, so
	/// half the menu was reachable only by guessing which unlabelled tab held
	/// it. That is the scale problem this menu exists to solve, in the control
	/// that is supposed to solve it.
	/// </remarks>
	public sealed record MenuCategoryCount(string Id, int Count) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("count");
			writer.Write(Count);
			writer.TypeEnd();
		}
	}
}
