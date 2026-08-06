using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options
{
	/// <summary>
	/// Filters the asset grid by what a service building is for.
	/// </summary>
	/// <remarks>
	/// Building Lens could already narrow by role while the grid could not, even
	/// though PrefabIndex has carried the value all along. The options come from
	/// <see cref="BuildingRole.Known"/> so every entry offered is one the indexer
	/// can actually produce.
	/// </remarks>
	internal class RoleOption : IOptionSection
	{
		private static readonly Dictionary<string, string> Icons = new()
		{
			["School"] = "Media/Game/Icons/Education.svg",
			["Hospital"] = "Media/Game/Icons/Healthcare.svg",
			["FireStation"] = "Media/Game/Icons/FireSafety.svg",
			["PoliceStation"] = "Media/Game/Icons/Police.svg",
			["Prison"] = "Media/Game/Icons/Police.svg",
			["EmergencyShelter"] = "Media/Game/Icons/FireSafety.svg",
			["WaterPumpingStation"] = "Media/Game/Icons/Water.svg",
			["WastewaterTreatmentPlant"] = "Media/Game/Icons/Water.svg",
			["SewageOutlet"] = "Media/Game/Icons/Water.svg",
			["GarbageFacility"] = "Media/Game/Icons/Garbage.svg",
			["DeathcareFacility"] = "Media/Game/Icons/Healthcare.svg",
		};

		private readonly OptionsUISystem _optionsUISystem;

		public int Id { get; } = 16;

		public RoleOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			var selected = FindItUtil.Filters.SelectedRoles;

			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.Role]"),
				Options = BuildingRole.Known.Select((role, index) => new OptionItemUIEntry
				{
					Id = index,
					Name = LocaleHelper.GetTooltip($"Role{role}"),
					Icon = Icons.TryGetValue(role, out var icon)
						? icon
						: "coui://finditbuildingmenu/Icons/Colored/ServiceBuilding.svg",
					Selected = selected is not null && selected.Contains(role),
				}).ToArray(),
			};
		}

		public bool IsVisible()
		{
			// Only service buildings carry a role, so the section would be an
			// all-empty filter anywhere else.
			return FindItUtil.CurrentCategory is PrefabCategory.ServiceBuildings or PrefabCategory.Any;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			if (optionId < 0 || optionId >= BuildingRole.Known.Count)
			{
				return;
			}

			var role = BuildingRole.Known[optionId];
			var selected = FindItUtil.Filters.SelectedRoles ??= new List<string>();

			// Multi-select: roles are a union, so clicking a second one widens
			// the result rather than replacing the first.
			if (!selected.Remove(role))
			{
				selected.Add(role);
			}

			_optionsUISystem.TriggerSearch();
		}

		public void OnReset()
		{
			FindItUtil.Filters.SelectedRoles = null;
		}

		public bool IsDefault()
		{
			return FindItUtil.Filters.SelectedRoles is not { Count: > 0 };
		}
	}
}
