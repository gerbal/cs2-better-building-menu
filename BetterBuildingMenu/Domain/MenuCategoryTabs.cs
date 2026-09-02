using Colossal.UI.Binding;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One category's sub-tabs, drawn in its place in the strip.
	/// </summary>
	/// <remarks>
	/// A LIST of these replaces the single expanded category the development
	/// tree assumed. The dev tree only ever needed one — it picks the largest
	/// category and stops — but a zone menu needs three at once, because
	/// Residential, Commercial and Office all divide into tiers.
	///
	/// The substitution rule is the school levels': sub-tabs may stand in for a
	/// category only when they partition it, so a category whose entries all
	/// share one value is left alone. That is what keeps Industrial and the
	/// extractor areas as plain tabs.
	/// </remarks>
	public sealed record MenuCategoryTabs(string CategoryId, MenuBranchCount[] Tabs) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("categoryId");
			writer.Write(CategoryId ?? string.Empty);
			writer.PropertyName("tabs");
			writer.ArrayBegin((Tabs ?? Array.Empty<MenuBranchCount>()).Length);

			foreach (var tab in Tabs ?? Array.Empty<MenuBranchCount>())
			{
				tab.Write(writer);
			}

			writer.ArrayEnd();
			writer.TypeEnd();
		}
	}
}
