using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

namespace FindItBuildingMenu.Domain.Options
{
	/// <summary>
	/// The building lens's own "placement" facet — the subset of
	/// <see cref="Game.Prefabs.BuildingFlags"/> actually present among the
	/// buildings currently in scope — in the options bank when that subset is
	/// short enough to scan as icons.
	/// </summary>
	/// <remarks>
	/// This is deliberately separate from <see cref="PlacementFlagOption"/>,
	/// which offers every placement flag unconditionally as a pre-filter on
	/// the legacy grid (and, as a side effect, on the lens catalog beneath it —
	/// see BuildingCatalogAdapter.GetIndexedBuildings). That option can be
	/// visible at the same time as this one — confirmed live: its
	/// visibility only depends on FindItUtil.CurrentCategory being
	/// Buildings/ServiceBuildings/Any, which is the default and is never
	/// changed just because the lens turns on, so both rows can be on screen
	/// together. <see cref="PlacementFlagOption"/> is upstream FindIt's and
	/// keeps its own "Placement" title; this row uses its own locale key
	/// (<c>Options.LABEL[FindItBuildingMenu.LensPlacement]</c>) instead of
	/// sharing that one, so two different filters never wear the same label.
	/// </remarks>
	internal sealed class BuildingLensPlacementOption : BuildingLensFacetOptionBase
	{
		public BuildingLensPlacementOption(OptionsUISystem optionsUISystem)
			: base(optionsUISystem, id: 20, facetId: "placement")
		{
		}

		protected override string SectionName =>
			LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.LensPlacement]");

		// Reuses PlacementFlagOption's tooltip keys and icon table: facet
		// option ids are the same BuildingFlags names that option already
		// carries locale entries and icons for.
		protected override string OptionName(BuildingCatalogFacetOption option) =>
			LocaleHelper.GetTooltip($"Placement{option.Id}");

		protected override string OptionIcon(BuildingCatalogFacetOption option) =>
			PlacementFlagOption.IconForFlagName(option.Id) ?? "coui://finditbuildingmenu/Icons/Standard/StarAll.svg";
	}
}
