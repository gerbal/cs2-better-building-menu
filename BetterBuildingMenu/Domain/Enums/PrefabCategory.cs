namespace BetterBuildingMenu.Domain.Enums
{
	public enum PrefabCategory
	{
		[CategoryIcon("coui://uil/Standard/StarAll.svg")]
		Any = -1,
		[CategoryIcon("coui://uil/Colored/BuildingZoneSignature.svg")]
		Buildings = 100,
		[CategoryIcon("coui://uil/Colored/ServiceBuilding.svg")]
		ServiceBuildings = 200,
		[CategoryIcon("coui://uil/Colored/Road.svg")]
		Networks = 300,
		[CategoryIcon("coui://uil/Colored/Nature.svg")]
		Trees = 400,
		[CategoryIcon("coui://uil/Colored/BenchAndLampProps.svg")]
		Props = 500,
		// Zones are a category only because the index has to file them somewhere, and
		// being in the index is what makes them armable: TryActivatePrefabTool arms only
		// what CatalogIndex.GetPrefab finds. The catalog's zone/building split is EntryKind.
		[CategoryIcon("Media/Game/Icons/Zones.svg")]
		Zones = 700
	}
}
