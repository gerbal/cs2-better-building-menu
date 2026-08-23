using Colossal.UI.Binding;

using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
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
		/// Whether the active sort could move any row of this result set.
		/// </summary>
		/// <remarks>
		/// cm-ddw3. False when every value ties, or ties within every group.
		/// The sort control still responds either way, so without this the
		/// player gets a control that answers attached to a list that does not.
		/// </remarks>
		bool SortCanReorder = true) : IJsonWritable
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

			// cm-ddw3. False when the active sort cannot move a single row of
			// this result set — every value ties, or ties within every group.
			// The sort control still responds, so without this the player gets
			// a control that answers attached to a list that does not, which is
			// the signature of a broken one.
			writer.PropertyName("sortCanReorder");
			writer.Write(SortCanReorder);

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
