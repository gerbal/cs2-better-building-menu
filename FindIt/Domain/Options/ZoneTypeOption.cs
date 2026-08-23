using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options
{
    internal class ZoneTypeOption : IOptionSection
	{
		private readonly OptionsUISystem _optionsUISystem;
		/// <summary>
		/// One icon per tier, in reading order.
		/// </summary>
		/// <remarks>
		/// Static and shared, because the category strip draws the same tiers
		/// and a second copy of this table is exactly how two views of one fact
		/// drift apart — which has already happened twice in this codebase.
		///
		/// The chips below are projected from THIS DICTIONARY, not from the
		/// enum, so a tier with no entry here is silently invisible: no crash,
		/// no placeholder, the chip just never draws. GameLocaleKeyTests guards
		/// the matching tooltip keys for the same reason.
		/// </remarks>
		private static readonly Dictionary<ZoneTypeFilter, string> Icons = new()
		{
			[ZoneTypeFilter.Any] = "coui://finditbuildingmenu/Icons/Standard/StarAll.svg",
			[ZoneTypeFilter.Low] = "coui://finditbuildingmenu/Icons/Standard/LowLevel.svg",
			[ZoneTypeFilter.Row] = "coui://finditbuildingmenu/Icons/Standard/Row.svg",
			[ZoneTypeFilter.Medium] = "coui://finditbuildingmenu/Icons/Standard/MediumLevel.svg",
			[ZoneTypeFilter.Mixed] = "coui://finditbuildingmenu/Icons/Standard/MixedLevel.svg",
			[ZoneTypeFilter.LowRent] = "coui://finditbuildingmenu/Icons/Standard/LowRentLevel.svg",
			[ZoneTypeFilter.High] = "coui://finditbuildingmenu/Icons/Standard/HighLevel.svg",
			[ZoneTypeFilter.Signature] = "coui://finditbuildingmenu/signature.svg",
		};

		private readonly Dictionary<ZoneTypeFilter, string> _styles;

		public int Id { get; } = 15;

		/// <summary>The tier's icon, or empty when it has none.</summary>
		public static string IconFor(ZoneTypeFilter density) =>
			Icons.TryGetValue(density, out var icon) ? icon : string.Empty;

		public ZoneTypeOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
			_styles = Icons;
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.ZoneType]"),
				Options = _styles.Select(x => new OptionItemUIEntry
				{
					Id = (int)x.Key,
					Name = LocaleHelper.GetTooltip(x.Key == ZoneTypeFilter.Any ? "Any" : $"Zone{x.Key}"),
					Icon = x.Value,
					Selected = FindItUtil.Filters.SelectedZoneType == x.Key
				}).ToArray()
			};
		}

		public bool IsVisible()
		{
			return FindItUtil.CurrentCategory is PrefabCategory.Buildings
				&& (FindItUtil.CurrentSubCategory is PrefabSubCategory.Any or PrefabSubCategory.Buildings_Residential or PrefabSubCategory.Buildings_Mixed or PrefabSubCategory.Buildings_Commercial or PrefabSubCategory.Buildings_Office or PrefabSubCategory.Buildings_Industrial);
		}

		public void OnOptionClicked(int optionId, int value)
		{
			FindItUtil.Filters.SelectedZoneType = (ZoneTypeFilter)optionId;

			_optionsUISystem.TriggerSearch();
		}

		public void OnReset()
		{
			FindItUtil.Filters.SelectedZoneType = ZoneTypeFilter.Any;
		}

		public bool IsDefault()
		{
			return FindItUtil.Filters.SelectedZoneType == ZoneTypeFilter.Any;
		}
	}
}
