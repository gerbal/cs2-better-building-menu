using Colossal.UI.Binding;

using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	public sealed record BuildingCatalogPage(
		IReadOnlyList<BuildingCatalogEntry> Items,
		int TotalCount,
		int Offset,
		int Limit) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.PropertyName("items");
			writer.ArrayBegin((uint)Items.Count);
			foreach (var item in Items)
			{
				item.Write(writer);
			}
			writer.ArrayEnd();

			writer.PropertyName("totalCount");
			writer.Write(TotalCount);
			writer.PropertyName("offset");
			writer.Write(Offset);
			writer.PropertyName("limit");
			writer.Write(Limit);

			writer.TypeEnd();
		}
	}
}
