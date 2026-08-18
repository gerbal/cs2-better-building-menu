using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

namespace FindItBuildingMenu.Domain.Options
{
    internal class SortingDirectionOption : IOptionSection
	{
		private readonly OptionsUISystem _optionsUISystem;

		public int Id { get; } = -1;

		public SortingDirectionOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.SortOrder]"),
				Options = new[]
				{
					new OptionItemUIEntry
					{
						Id = 0,
						Name = LocaleHelper.GetTooltip("Ascending"),
						Icon = "coui://finditbuildingmenu/Icons/Standard/ArrowSortLowDown.svg",
						Selected = !IndexedPrefabList.SortingDescending
					},
					new OptionItemUIEntry
					{
						Id = 1,
						Name = LocaleHelper.GetTooltip("Descending"),
						Icon = "coui://finditbuildingmenu/Icons/Standard/ArrowSortHighDown.svg",
						Selected = IndexedPrefabList.SortingDescending
					},
				}
			};
		}

		public bool IsVisible()
		{
			return true;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			FindItUtil.SetSorting(optionId != 0);

			_optionsUISystem.RefreshLens();
		}

		public void OnReset()
		{ }

		public bool IsDefault()
		{
			return true;
		}
	}
}
