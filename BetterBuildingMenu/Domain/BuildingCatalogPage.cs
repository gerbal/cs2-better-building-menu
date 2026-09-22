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
		/// This side owns the answer: the client cannot derive it without repeating the
		/// engine's offset clamp, and a lit "Load more" on a complete list is a lie.
		/// </remarks>
		bool HasMore = false,
		/// <summary>
		/// The offered sort fields that could actually move a row here.
		/// </summary>
		/// <remarks>
		/// The picker drops the rest rather than annotating them, the same way
		/// groupDimensionsFor drops a grouping that cannot act.
		/// </remarks>
		IReadOnlyList<string>? ReorderableSortColumns = null,
		/// <summary>
		/// The row Enter arms while a search is active; null without a search or a result.
		/// </summary>
		/// <remarks>
		/// Named here rather than inferred from the first row: grouping orders the page by
		/// group first, so the best match can sit anywhere in it, and only this side scores.
		/// </remarks>
		int? BestMatchId = null,
		/// <summary>The search this page answers, as the query ran it.</summary>
		/// <remarks>
		/// The box echoes a keystroke at once and the page follows a debounce later, so Enter
		/// holds until the two agree rather than arming the previous search's match.
		/// </remarks>
		string? SearchText = null) : IJsonWritable
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
			writer.PropertyName("bestMatchId");
			if (BestMatchId.HasValue) writer.Write(BestMatchId.Value); else writer.WriteNull();
			writer.PropertyName("searchText");
			writer.Write(SearchText ?? string.Empty);
			if (Status is not null)
			{
				writer.PropertyName("status");
				writer.Write(Status);
			}

			writer.TypeEnd();
		}
	}
}
