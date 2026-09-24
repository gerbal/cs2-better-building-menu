namespace BetterBuildingMenu.Domain.Enums
{
	public enum PrefabCategory
	{
		[CategoryIcon("coui://betterbuildingmenu/Icons/Standard/StarAll.svg")]
		Any = -1,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/BuildingZoneSignature.svg")]
		Buildings = 100,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/ServiceBuilding.svg")]
		ServiceBuildings = 200,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Road.svg")]
		Networks = 300,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Nature.svg")]
		Trees = 400,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/BenchAndLampProps.svg")]
		Props = 500,
		// Zones are a category only because the index has to file them somewhere, and
		// being in the index is what makes them armable — CatalogIndex.GetPrefab reads
		// only the index. The catalog's zone/building split is EntryKind.
		[CategoryIcon("Media/Game/Icons/Zones.svg")]
		Zones = 700
	}
}
