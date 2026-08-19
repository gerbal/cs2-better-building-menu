using Colossal.UI.Binding;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// How many assets sit behind one tier of the menu's progression strip.
	/// </summary>
	/// <remarks>
	/// The sibling of <see cref="MenuCategoryCount"/>, and a sidecar for the
	/// same reason: the milestone table is fixed for the session, the counts
	/// move with every keystroke.
	///
	/// It carries the INDEX and no name. The names are already published once,
	/// densely by index, in the BuildingLensMilestones binding — repeating one
	/// here would give the UI two places to read the same string from, and they
	/// would disagree the moment a language change refreshed only one.
	///
	/// Why it exists: the category strip is empty on the menus vanilla never
	/// split — Electricity is one category, so there was nothing to draw and
	/// the strip hid itself. Progression is an axis EVERY menu has, because
	/// every asset is gated behind some point in it, so it gives those menus a
	/// strip and gives the split menus a second way to cut a large one.
	/// </remarks>
	public sealed record MenuMilestoneCount(int Milestone, int Count) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("milestone");
			writer.Write(Milestone);
			writer.PropertyName("count");
			writer.Write(Count);
			writer.TypeEnd();
		}
	}
}
