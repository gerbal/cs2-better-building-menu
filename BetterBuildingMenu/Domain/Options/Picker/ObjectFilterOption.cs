using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Domain.UIBinding;
using BetterBuildingMenu.Systems;
using BetterBuildingMenu.Utilities;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain.Options.Picker
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
				[PickerFlags.All] = "coui://betterbuildingmenu/Icons/Standard/StarAll.svg",
				[PickerFlags.SubObjects] = "coui://betterbuildingmenu/subitem.svg",
				[PickerFlags.Buildings] = "coui://betterbuildingmenu/buildings.svg",
				[PickerFlags.Props] = "coui://betterbuildingmenu/props.svg",
				[PickerFlags.Networks] = "coui://betterbuildingmenu/networks.svg",
				[PickerFlags.Surfaces] = "coui://betterbuildingmenu/areas.svg",
			};
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Tooltip.LABEL[BetterBuildingMenu.Filters]"),
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
