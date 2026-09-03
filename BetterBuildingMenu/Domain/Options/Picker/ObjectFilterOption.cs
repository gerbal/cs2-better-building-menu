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
		/// <summary>Icon and English label per filter, keyed by the flag it toggles.</summary>
		/// <remarks>
		/// Static because it is constant, and internal because the label half is
		/// the fallback shown when the active locale has no translation for the
		/// row — so it has to keep saying what Locale.json says. PickerOptionTests
		/// asserts that; the pair drifted once already while this was being
		/// written, with "Any" written against a key that ships "All".
		/// </remarks>
		internal static readonly Dictionary<PickerFlags, (string Icon, string Label)> Styles = new()
		{
			[PickerFlags.All] = ("coui://betterbuildingmenu/Icons/Standard/StarAll.svg", "All"),
			[PickerFlags.SubObjects] = ("coui://betterbuildingmenu/subitem.svg", "Sub-Objects"),
			[PickerFlags.Buildings] = ("coui://betterbuildingmenu/buildings.svg", "Buildings"),
			[PickerFlags.Props] = ("coui://betterbuildingmenu/props.svg", "Props"),
			[PickerFlags.Networks] = ("coui://betterbuildingmenu/networks.svg", "Networks"),
			[PickerFlags.Surfaces] = ("coui://betterbuildingmenu/areas.svg", "Surfaces"),
		};

		/// <summary>The locale key for a filter row, which is also how the test finds it.</summary>
		internal static string TooltipKeyFor(PickerFlags flag) =>
			flag == PickerFlags.All ? "Any" : $"Picker{flag}";

		public int Id { get; } = 14;

		public ObjectFilterOption(OptionsUISystem optionsUISystem)
		{
			_pickerToolSystem = optionsUISystem.World.GetOrCreateSystemManaged<PickerToolSystem>();
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Tooltip.LABEL[BetterBuildingMenu.Filters]"),
				Options = Styles.Select(x => new OptionItemUIEntry
				{
					Id = (int)x.Key,
					Name = LocaleHelper.GetTooltip(TooltipKeyFor(x.Key), x.Value.Label),
					Icon = x.Value.Icon,
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
