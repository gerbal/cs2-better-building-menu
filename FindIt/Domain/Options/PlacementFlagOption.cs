using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

using Game.Prefabs;

using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options
{
	/// <summary>
	/// Filters the asset grid by the placement constraints a building carries.
	/// </summary>
	/// <remarks>
	/// Building Lens has been able to filter on Game.Prefabs.BuildingFlags since
	/// the lens shipped; the grid could not, despite PrefabIndex already holding
	/// the value. Every flag is offered, including the lot and wiring internals,
	/// because those are exactly what a modder wants to search on. Selections
	/// are ANDed: picking two constraints asks for a building satisfying both.
	/// </remarks>
	internal class PlacementFlagOption : IOptionSection
	{
		/// <summary>
		/// Ordered so the flags that decide where a building can go come first
		/// and the lot internals last, matching how the lens groups them.
		/// </summary>
		private static readonly (BuildingFlags Flag, string Icon)[] Flags =
		{
			(BuildingFlags.RequireRoad, "coui://finditbuildingmenu/Icons/Colored/Road.svg"),
			(BuildingFlags.NoRoadConnection, "coui://finditbuildingmenu/Icons/Colored/Nature.svg"),
			(BuildingFlags.RequireAccess, "coui://finditbuildingmenu/Icons/Colored/PedestrianPath.svg"),
			(BuildingFlags.CanBeOnRoad, "coui://finditbuildingmenu/Icons/Colored/Road.svg"),
			(BuildingFlags.CanBeOnRoadArea, "coui://finditbuildingmenu/Icons/Colored/Lanes.svg"),
			(BuildingFlags.CanBeRoadSide, "coui://finditbuildingmenu/Icons/Colored/BusShelter.svg"),

			(BuildingFlags.LeftAccess, "coui://finditbuildingmenu/Icons/Standard/AlignLeft.svg"),
			(BuildingFlags.RightAccess, "coui://finditbuildingmenu/Icons/Standard/AlignRight.svg"),
			(BuildingFlags.BackAccess, "coui://finditbuildingmenu/Icons/Standard/AlignCenter.svg"),
			(BuildingFlags.RestrictedPedestrian, "coui://finditbuildingmenu/Icons/Colored/PedestrianPath.svg"),
			(BuildingFlags.RestrictedCar, "coui://finditbuildingmenu/Icons/Colored/DeliveryVan.svg"),
			(BuildingFlags.RestrictedParking, "coui://finditbuildingmenu/Icons/Colored/GenericVehicle.svg"),
			(BuildingFlags.RestrictedTrack, "coui://finditbuildingmenu/Icons/Colored/RailTrack.svg"),

			(BuildingFlags.HasWaterNode, "Media/Game/Icons/Water.svg"),
			(BuildingFlags.HasSewageNode, "Media/Game/Icons/Water.svg"),
			(BuildingFlags.HasLowVoltageNode, "Media/Game/Icons/Electricity.svg"),
			(BuildingFlags.HasResourceNode, "coui://finditbuildingmenu/Icons/Colored/PropIndustrial.svg"),

			(BuildingFlags.ColorizeLot, "coui://finditbuildingmenu/Icons/Colored/Decals.svg"),
			(BuildingFlags.HasInsideRoom, "coui://finditbuildingmenu/Icons/Colored/FurnitureIso.svg"),
		};

		private readonly OptionsUISystem _optionsUISystem;

		public int Id { get; } = 17;

		public PlacementFlagOption(OptionsUISystem optionsUISystem)
		{
			_optionsUISystem = optionsUISystem;
		}

		public OptionSectionUIEntry AsUIEntry()
		{
			var required = FindItUtil.Filters.RequiredPlacementFlags;

			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = LocaleHelper.Translate("Options.LABEL[FindItBuildingMenu.Placement]"),
				Options = Flags.Select(entry => new OptionItemUIEntry
				{
					Id = (int)entry.Flag,
					Name = LocaleHelper.GetTooltip($"Placement{entry.Flag}"),
					Icon = entry.Icon,
					Selected = required.HasValue && (required.Value & entry.Flag) == entry.Flag,
				}).ToArray(),
			};
		}

		public bool IsVisible()
		{
			return FindItUtil.CurrentCategory
				is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings or PrefabCategory.Any;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			var flag = (BuildingFlags)optionId;
			var current = FindItUtil.Filters.RequiredPlacementFlags ?? default;

			FindItUtil.Filters.RequiredPlacementFlags = (current & flag) == flag
				? current & ~flag
				: current | flag;

			_optionsUISystem.TriggerSearch();
		}

		public void OnReset()
		{
			FindItUtil.Filters.RequiredPlacementFlags = null;
		}

		public bool IsDefault()
		{
			var required = FindItUtil.Filters.RequiredPlacementFlags;

			return !required.HasValue || required.Value == default;
		}
	}
}
