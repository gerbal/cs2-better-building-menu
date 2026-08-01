using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options.Picker
{
    internal class ObjectFilterOption : IOptionSection
	{
		private readonly PickerToolSystem _pickerToolSystem;
		private readonly Dictionary<PickerFlags, string> _styles;

		public int Id { get; } = 14;

		public ObjectFilterOption(OptionsUISystem optionsUISystem)
		{
			_pickerToolSystem = optionsUISystem.World.GetOrCreateSystemManaged<PickerToolSystem>();
			_styles = new()
			{
				[PickerFlags.All] = "coui://finditbuildingmenu/Icons/Standard/StarAll.svg",
				[PickerFlags.SubObjects] = "coui://finditbuildingmenu/subitem.svg",
				[PickerFlags.Buildings] = "coui://finditbuildingmenu/buildings.svg",
				[PickerFlags.Props] = "coui://finditbuildingmenu/props.svg",
				[PickerFlags.Networks] = "coui://finditbuildingmenu/networks.svg",
				[PickerFlags.Surfaces] = "coui://finditbuildingmenu/areas.svg",
			};
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Tooltip.LABEL[FindItBuildingMenu.Filters]"),
				Options = _styles.Select(x => new OptionItemUIEntry
				{
					Id = (int)x.Key,
					Name = LocaleHelper.GetTooltip(x.Key == PickerFlags.All ? "Any" : $"Picker{x.Key}"),
					Icon = x.Value,
					Selected = _pickerToolSystem.Flags.HasFlag(x.Key)
				}).ToArray()
			};
		}

		public bool IsVisible()
		{
			return true;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			var flag = (PickerFlags)optionId;

			if (_pickerToolSystem.Flags.HasFlag(flag))
			{
				_pickerToolSystem.Flags &= ~flag;
			}
			else
			{
				_pickerToolSystem.Flags |= flag;
			}
		}

		public void OnReset()
		{
		}

		public bool IsDefault()
		{
			return false;
		}
	}
}
