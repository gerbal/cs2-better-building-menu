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
		private readonly Dictionary<ZoneTypeFilter, string> _styles;

		public int Id { get; } = 15;

		public ZoneTypeOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
			_styles = new()
			{
				[ZoneTypeFilter.Any] = "coui://finditbuildingmenu/Icons/Standard/StarAll.svg",
				[ZoneTypeFilter.Low] = "coui://finditbuildingmenu/Icons/Standard/LowLevel.svg",
				[ZoneTypeFilter.Row] = "coui://finditbuildingmenu/Icons/Standard/Row.svg",
				[ZoneTypeFilter.Medium] = "coui://finditbuildingmenu/Icons/Standard/MediumLevel.svg",
				[ZoneTypeFilter.High] = "coui://finditbuildingmenu/Icons/Standard/HighLevel.svg",
				[ZoneTypeFilter.Signature] = "coui://finditbuildingmenu/signature.svg",
			};
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
