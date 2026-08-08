using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

using System;

namespace FindItBuildingMenu.Domain.Options
{
	/// <summary>
	/// The building lens's "Locked"/"Unlocked" progression facet, in the
	/// options bank because a catalog only ever offers the two values.
	/// </summary>
	internal sealed class BuildingLensAvailabilityOption : BuildingLensFacetOptionBase
	{
		public BuildingLensAvailabilityOption(OptionsUISystem optionsUISystem)
			: base(optionsUISystem, id: 18, facetId: "availability")
		{
		}

		protected override string SectionName =>
			LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.AvailabilityFilter]");

		// "Locked" and "Unlocked" both have dedicated tooltip keys already.
		protected override string OptionName(BuildingCatalogFacetOption option) =>
			LocaleHelper.GetTooltip(option.Id);

		protected override string OptionIcon(BuildingCatalogFacetOption option) =>
			string.Equals(option.Id, "Locked", StringComparison.OrdinalIgnoreCase)
				? "Media/Glyphs/Lock.svg"
				: "Media/Glyphs/OpenLock.svg";
	}
}
