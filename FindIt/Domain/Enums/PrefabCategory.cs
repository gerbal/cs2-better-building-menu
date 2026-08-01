namespace FindItBuildingMenu.Domain.Enums
{
	public enum PrefabCategory
	{
		[CategoryIcon("coui://finditbuildingmenu/Icons/Standard/StarAll.svg")]
		Any = -1,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/StarFilledSmallIso.svg")]
		Favorite = 0,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/BuildingZoneSignature.svg")]
		Buildings = 100,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/ServiceBuilding.svg")]
		ServiceBuildings = 200,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Road.svg")]
		Networks = 300,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Nature.svg")]
		Trees = 400,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/BenchAndLampProps.svg")]
		Props = 500,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/GenericVehicleIsometric.svg")]
		Vehicles = 600
	}
}
