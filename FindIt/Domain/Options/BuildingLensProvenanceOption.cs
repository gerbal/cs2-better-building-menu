using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

using System;

namespace FindItBuildingMenu.Domain.Options
{
	/// <summary>
	/// The building lens's "Base game"/"Custom content" source facet, in the
	/// options bank because a catalog only ever offers the two values.
	/// </summary>
	/// <remarks>
	/// Option labels come straight from the facet ("Base game", "Custom
	/// content" — see BuildingCatalogAdapter.FormatProvenanceLabel) rather than
	/// through a Locale.json entry: the rest of the facet-driven lens UI (the
	/// rail, the chips) already shows these same strings unlocalized, so this
	/// stays consistent with that instead of being the one facet with its own
	/// translation.
	/// </remarks>
	internal sealed class BuildingLensProvenanceOption : BuildingLensFacetOptionBase
	{
		public BuildingLensProvenanceOption(OptionsUISystem optionsUISystem)
			: base(optionsUISystem, id: 19, facetId: "provenance")
		{
		}

		protected override string SectionName =>
			LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.ProvenanceFilter]");

		protected override string OptionIcon(BuildingCatalogFacetOption option) =>
			string.Equals(option.Id, "Vanilla", StringComparison.OrdinalIgnoreCase)
				? "Media/Menu/GameLogo.svg"
				: "coui://finditbuildingmenu/Icons/Standard/PDXPlatypusHexagon.svg";
	}
}
