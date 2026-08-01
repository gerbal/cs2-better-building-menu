using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options
{
    internal class BuilderCornerOption : IOptionSection
	{
		private readonly OptionsUISystem _optionsUISystem;
		private readonly Dictionary<BuildingCornerFilter, string> _styles;

		public int Id { get; } = 14;

		public BuilderCornerOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
			_styles = new()
			{
				[BuildingCornerFilter.Any] = "coui://finditbuildingmenu/Icons/Standard/StarAll.svg",
				[BuildingCornerFilter.Left] = "coui://finditbuildingmenu/Icons/Standard/BuildingCornerLeft.svg",
				[BuildingCornerFilter.Front] = "coui://finditbuildingmenu/Icons/Standard/BuildingFront.svg",
				[BuildingCornerFilter.Right] = "coui://finditbuildingmenu/Icons/Standard/BuildingCornerRight.svg",
			};
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.BuilderCorner]"),
				Options = _styles.Select(x => new OptionItemUIEntry
				{
					Id = (int)x.Key,
					Name = LocaleHelper.GetTooltip(x.Key == BuildingCornerFilter.Any ? "Any" : $"Corner{x.Key}"),
					Icon = x.Value,
					Selected = FindItUtil.Filters.SelectedBuildingCorner == x.Key
				}).ToArray()
			};
		}

		public bool IsVisible()
		{
			return FindItUtil.CurrentCategory is Domain.Enums.PrefabCategory.Buildings or Domain.Enums.PrefabCategory.ServiceBuildings;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			FindItUtil.Filters.SelectedBuildingCorner = (BuildingCornerFilter)optionId;

			_optionsUISystem.TriggerSearch();
		}

		public void OnReset()
		{
			FindItUtil.Filters.SelectedBuildingCorner = BuildingCornerFilter.Any;
		}

		public bool IsDefault()
		{
			return FindItUtil.Filters.SelectedBuildingCorner == BuildingCornerFilter.Any;
		}
	}
}
