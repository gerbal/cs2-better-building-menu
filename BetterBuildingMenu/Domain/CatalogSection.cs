using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A label over a run of the result: a group's name, or the locked rows a half-locked tab lists last.
	/// Counted over the whole result, so a label names its true count whatever the window holds.
	/// </summary>
	/// <param name="Id">The section's own name: "locked", or "group:" and its place among the groups.</param>
	/// <param name="Kind"><see cref="Group"/> or <see cref="Locked"/>.</param>
	/// <param name="Label">A group's heading, as the grouping names it; empty for the locked rows, which the UI names.</param>
	/// <param name="LabelId">The game's id behind a group's heading, where there is one, so the UI can say it in the game's language.</param>
	/// <param name="Start">Where its first row sits in the order the window slices; its place in a window is this less the page's Offset.</param>
	/// <param name="Count">How many rows it holds, collapsed or not.</param>
	/// <param name="Collapsed">Whether its rows are left out of the window, so only its label shows.</param>
	/// <remarks>See docs/design-notes.md, "Label plates".</remarks>
	public sealed record CatalogSection(string Id, string Kind, string Label, string LabelId, int Start, int Count, bool Collapsed) : IJsonWritable
	{
		/// <summary>A group of the grouping the page is ordered by.</summary>
		public const string Group = "group";

		/// <summary>A half-locked tab's locked rows, after its buildable ones.</summary>
		public const string Locked = "locked";

		/// <summary>The locked rows' section, the one a click collapses.</summary>
		public const string LockedId = "locked";

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("kind");
			writer.Write(Kind);
			writer.PropertyName("label");
			writer.Write(Label);
			writer.PropertyName("labelId");
			writer.Write(LabelId);
			writer.PropertyName("start");
			writer.Write(Start);
			writer.PropertyName("count");
			writer.Write(Count);
			writer.PropertyName("collapsed");
			writer.Write(Collapsed);
			writer.TypeEnd();
		}
	}
}
