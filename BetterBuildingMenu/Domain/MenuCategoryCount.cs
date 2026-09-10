using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// How many assets sit behind one tab of the menu's category strip.
	/// </summary>
	/// <remarks>
	/// A sidecar to <see cref="VanillaMenuCategory"/> rather than a field on it: the
	/// category tree is the game's and does not move, while the count belongs to the
	/// current query and would republish the whole tree on every keystroke.
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
