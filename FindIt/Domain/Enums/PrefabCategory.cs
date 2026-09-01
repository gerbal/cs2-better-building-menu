namespace FindItBuildingMenu.Domain.Enums
{
	public enum PrefabCategory
	{
		[CategoryIcon("coui://finditbuildingmenu/Icons/Standard/StarAll.svg")]
		Any = -1,
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
		Vehicles = 600,
		// Zones are a category because the index has no other place to put them,
		// and being in the index is what makes them armable: ActivatePrefabTool
		// walks every tool asking TrySetPrefab, ZoneToolSystem accepts any
		// ZonePrefab, and FindItUtil.GetPrefabBase only reads CategorizedPrefabs.
		// Before this a zone id through SetCurrentPrefab was a silent no-op.
		//
		// This is not the zone-vs-building distinction the catalog draws — that
		// is EntryKind, per the design. This is only the index's own filing.
		[CategoryIcon("Media/Game/Icons/Zones.svg")]
		Zones = 700
	}
}
