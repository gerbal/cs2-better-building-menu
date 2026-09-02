using Colossal.UI.Binding;

using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	public sealed record BuildingCatalogPage(
		IReadOnlyList<BuildingCatalogEntry> Items,
		int TotalCount,
		int Offset,
		int Limit,
		string? Status = null,
		/// <summary>
		/// Whether the match set holds rows this window does not reach.
		/// </summary>
		/// <remarks>
		/// This side owns the answer. The client could not derive it without
		/// repeating the engine's offset clamp, and a Load more control that
		/// stays lit on a complete list is worse than no control at all.
		///
		/// Last and defaulted, so the construction sites that predate it stay
		/// untouched — the same reason BuildingCatalogEntry gives for IsLocked.
		/// </remarks>
		bool HasMore = false,
		/// <summary>
		/// The offered sort fields that could actually move a row here.
		/// </summary>
		/// <remarks>
		/// cm-ddw3. The picker drops the rest rather than annotating them, the
		/// same way groupDimensionsFor already drops a grouping that cannot act.
		/// </remarks>
		IReadOnlyList<string>? ReorderableSortColumns = null) : IJsonWritable
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

			writer.PropertyName("reorderableSortColumns");
			var columns = ReorderableSortColumns ?? System.Array.Empty<string>();
			writer.ArrayBegin((uint)columns.Count);
			foreach (var column in columns)
			{
				writer.Write(column);
			}
			writer.ArrayEnd();

			writer.PropertyName("totalCount");
			writer.Write(TotalCount);
			writer.PropertyName("offset");
			writer.Write(Offset);
			writer.PropertyName("limit");
			writer.Write(Limit);
			writer.PropertyName("hasMore");
			writer.Write(HasMore);
			if (Status is not null)
			{
				writer.PropertyName("status");
				writer.Write(Status);
			}

			writer.TypeEnd();
		}
	}
}
