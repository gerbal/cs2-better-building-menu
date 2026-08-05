using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// A pure snapshot of the legacy FindIt filter panel, used to tell the
	/// player which of those filters are shaping the Building Lens result.
	/// </summary>
	/// <remarks>
	/// <para>
	/// <see cref="BuildingCatalogAdapter"/> pre-filters the lens index with
	/// <c>Filters.GetFilterList(includeSearch: false)</c>, so every legacy
	/// toggle silently narrows the lens. The lens summary counted only its own
	/// facets, metric ranges, and capacity floor, so the panel could report
	/// "No active lens filters" while most of the catalog was hidden — the
	/// player had no way to discover why a search returned nothing.
	/// </para>
	/// <para>
	/// This is a snapshot rather than a reference to <see cref="Filters"/>
	/// because that type reaches into game prefab types, which would drag a
	/// running world into what is otherwise a pure, unit-testable projection.
	/// The ordering and the mutually-exclusive pairs below mirror
	/// <c>GetFilterList</c>; if a filter is added there it must be added here,
	/// or the summary silently under-reports again.
	/// </para>
	/// </remarks>
	public sealed record BuildingLensLegacyFilterSnapshot(
		bool HideAds = false,
		bool HideRandoms = false,
		bool HideVanilla = false,
		bool UniqueMesh = false,
		bool OnlyPlaced = false,
		bool HasDlc = false,
		bool WithParking = false,
		bool WithoutParking = false,
		bool HasZoneType = false,
		bool HasBuildingCorner = false,
		int BuildingLevel = 0,
		int LotDepth = 0,
		int LotWidth = 0,
		bool ThemeNone = false,
		bool HasTheme = false,
		bool HasAssetPacks = false)
	{
		public static readonly BuildingLensLegacyFilterSnapshot Empty = new();

		public bool HasSelection => Describe().Count > 0;

		public IReadOnlyList<string> Describe()
		{
			var active = new List<string>();

			if (HideAds)
			{
				active.Add("Hide ads");
			}

			if (HideRandoms)
			{
				active.Add("Hide randoms");
			}

			if (HideVanilla)
			{
				active.Add("Hide vanilla");
			}

			if (UniqueMesh)
			{
				active.Add("Unique mesh");
			}

			if (OnlyPlaced)
			{
				active.Add("Only placed");
			}

			if (HasDlc)
			{
				active.Add("DLC");
			}

			// GetFilterList applies these as if/else, so only the winning side
			// of each pair actually constrains the query.
			if (WithParking)
			{
				active.Add("With parking");
			}
			else if (WithoutParking)
			{
				active.Add("Without parking");
			}

			if (HasZoneType)
			{
				active.Add("Zone type");
			}

			if (HasBuildingCorner)
			{
				active.Add("Building corner");
			}

			if (BuildingLevel != 0)
			{
				active.Add("Building level");
			}

			if (LotDepth != 0)
			{
				active.Add("Lot depth");
			}

			if (LotWidth != 0)
			{
				active.Add("Lot width");
			}

			if (ThemeNone)
			{
				active.Add("No theme");
			}
			else if (HasTheme)
			{
				active.Add("Theme");
			}

			if (HasAssetPacks)
			{
				active.Add("Asset packs");
			}

			return active;
		}
	}
}
