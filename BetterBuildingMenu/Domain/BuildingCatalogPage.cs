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
		string? SearchText = null,
		/// <summary>The menu this page is the opening view of; empty when it is not one.</summary>
		/// <remarks>
		/// AssetMenuState.OpeningMenu: the menu with no category, tab or tier. A close sends no
		/// page, so the page a kept asset menu holds still says this at the next open. The UI
		/// shows the kept menu at once when this names the menu being opened, and waits for the
		/// next page when it does not.
		/// </remarks>
		string? Menu = null) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.Prop("items", Items);
			writer.Prop("reorderableSortColumns", ReorderableSortColumns);
			writer.Prop("totalCount", TotalCount);
			writer.Prop("offset", Offset);
			writer.Prop("limit", Limit);
			writer.Prop("hasMore", HasMore);
			writer.Prop("bestMatchId", BestMatchId);
			writer.Prop("searchText", SearchText ?? string.Empty);
			writer.Prop("menu", Menu ?? string.Empty);
			if (Status is not null)
			{
				writer.Prop("status", Status);
			}

			writer.TypeEnd();
		}
	}
}
