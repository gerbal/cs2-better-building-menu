using Colossal.UI.Binding;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Education's school levels, drawn as worded chips beside the tab that holds the schools.</summary>
	/// <remarks>
	/// The tab is found from the data, so a menu whose schools sit under another name still gets
	/// its levels. A level counts that tab's own schools, so the levels add up to the tab. See
	/// docs/design-notes.md, "Tab counts".
	/// </remarks>
	/// <param name="ParentCategory">The tab holding the most schools with a level, or empty for none.</param>
	/// <param name="ParentCount">What that tab lists under the filters and the search.</param>
	/// <param name="Tiers">One per level the tab holds, in career order, each counting what it lists.</param>
	public sealed record TierBracket(string ParentCategory, int ParentCount, MenuBranchCount[] Tiers) : IJsonWritable
	{
		/// <summary>No levels: every menu but Education, and an Education with no school.</summary>
		public static TierBracket Empty { get; } = new(string.Empty, 0, Array.Empty<MenuBranchCount>());

		public void Write(IJsonWriter writer)
		{
			var tiers = Tiers ?? Array.Empty<MenuBranchCount>();

			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("parentCategory");
			writer.Write(ParentCategory ?? string.Empty);
			writer.PropertyName("parentCount");
			writer.Write(ParentCount);
			writer.PropertyName("tiers");
			writer.ArrayBegin((uint)tiers.Length);

			foreach (var tier in tiers)
			{
				tier.Write(writer);
			}

			writer.ArrayEnd();
			writer.TypeEnd();
		}
	}
}
