using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options
{
    internal class SortingOption : IOptionSection
	{
		private readonly OptionsUISystem _optionsUISystem;
		private readonly Dictionary<PrefabSorting, string> _sortOptions;

		public int Id { get; } = -2;

		public SortingOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
			_sortOptions = new()
			{
				[PrefabSorting.Name] = "coui://finditbuildingmenu/Icons/Standard/NameSort.svg",
				[PrefabSorting.MostUsed] = "coui://finditbuildingmenu/Icons/Standard/Statistics.svg",
				[PrefabSorting.LastUsed] = "coui://finditbuildingmenu/Icons/Standard/ClockArrowBackward.svg",
				[PrefabSorting.InstalledDate] = "coui://finditbuildingmenu/dateAdd.svg",
				[PrefabSorting.UpdatedDate] = "coui://finditbuildingmenu/dateUpdate.svg",
				[PrefabSorting.UIOrder] = "coui://finditbuildingmenu/numbers.svg",
			};
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.Sorting]"),
				Options = _sortOptions.Select(x => new OptionItemUIEntry
				{
					Id = (int)x.Key,
					Name = LocaleHelper.GetTooltip($"Sorting{x.Key}"),
					Icon = x.Value,
					Selected = IndexedPrefabList.Sorting == x.Key
				}).ToArray()
			};
		}

		public bool IsVisible()
		{
			return true;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			FindItUtil.SetSorting(sorting: (PrefabSorting)optionId);

			_optionsUISystem.UpdateCategoriesAndPrefabList();
		}

		public void OnReset()
		{ }

		public bool IsDefault()
		{
			return true;
		}
	}
}
