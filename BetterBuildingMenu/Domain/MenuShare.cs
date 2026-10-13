using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// What the look's Auto rule reads of one menu: its rows, and how many carry a cost or a capacity,
	/// a capacity, or a lock. Over the whole menu, no filter or search or tab, so a filter never
	/// changes a menu's body.
	/// </summary>
	/// <param name="GroupRows">
	/// The rows under each label the menu's All draws in its own grouping, in order; empty where All draws
	/// none. A small menu opens on All, so its labels count toward the screen it must fit where its body
	/// draws them; a small menu of one tab draws none in its list unless picked, with Small menus grow on.
	/// </param>
	/// <param name="Tabs">The tabs the menu's row draws over its whole menu; a small menu with two or more keeps its labels.</param>
	/// <remarks>See docs/design-notes.md, "The bodies".</remarks>
	public sealed record MenuShare(string Menu, int Rows, int CostOrCapacity, int Capacity, int Locked, int[]? GroupRows = null, int Tabs = 0) : IJsonWritable
	{
		/// <summary>One menu's share, over its rows as the catalog lists it, with the labels its All draws and its tabs where given them.</summary>
		public static MenuShare Of(string menu, IEnumerable<BuildingCatalogEntry> rows, IEnumerable<CatalogSection>? allSections = null, int tabs = 0)
		{
			int count = 0, costOrCapacity = 0, capacity = 0, locked = 0;

			foreach (var row in rows)
			{
				count++;
				var hasCapacity = row.Capacity is > 0;

				if (hasCapacity)
				{
					capacity++;
				}

				if (hasCapacity || row.ConstructionCost is > 0)
				{
					costOrCapacity++;
				}

				if (row.IsLocked)
				{
					locked++;
				}
			}

			var groupRows = allSections?.Where(section => section.Kind == CatalogSection.Group).Select(section => section.Count).ToArray();

			return new MenuShare(menu, count, costOrCapacity, capacity, locked, groupRows, tabs);
		}

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("menu");
			writer.Write(Menu);
			writer.PropertyName("rows");
			writer.Write(Rows);
			writer.PropertyName("costOrCapacity");
			writer.Write(CostOrCapacity);
			writer.PropertyName("capacity");
			writer.Write(Capacity);
			writer.PropertyName("locked");
			writer.Write(Locked);
			writer.PropertyName("groupRows");
			var groupRows = GroupRows ?? Array.Empty<int>();
			writer.ArrayBegin((uint)groupRows.Length);
			foreach (var rows in groupRows)
			{
				writer.Write(rows);
			}

			writer.ArrayEnd();
			writer.PropertyName("tabs");
			writer.Write(Tabs);
			writer.TypeEnd();
		}
	}
}
