using Colossal.UI.Binding;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One category's sub-tabs, drawn in its place in the strip.
	/// </summary>
	/// <remarks>
	/// A list, not the single expanded category the development tree needs: a zone
	/// menu needs three at once. Sub-tabs may stand in for a category only when they
	/// partition it, so a category whose entries share one value is left alone.
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
