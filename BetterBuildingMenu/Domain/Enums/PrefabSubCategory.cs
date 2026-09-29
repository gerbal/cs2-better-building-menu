using System;

namespace BetterBuildingMenu.Domain.Enums
{
	public enum PrefabSubCategory
	{
		[CategoryIcon("coui://uil/Standard/StarAll.svg")]
		Any = PrefabCategory.Any,

		[Obsolete("Use PrefabCategory", true)]
		Buildings = PrefabCategory.Buildings,
		[CategoryIcon("Media/Game/Icons/ZoneResidential.svg")]
		Buildings_Residential,
		[CategoryIcon("coui://betterbuildingmenu/ZoneResidentialMixed.svg")]
		Buildings_Mixed,
		[CategoryIcon("Media/Game/Icons/ZoneCommercial.svg")]
		Buildings_Commercial,
		[CategoryIcon("Media/Game/Icons/ZoneIndustrial.svg")]
		Buildings_Industrial,
		[CategoryIcon("Media/Game/Icons/ZoneOffice.svg")]
		Buildings_Office,
		[CategoryIcon("Media/Game/Icons/ZoneExtractors.svg")]
		Buildings_Specialized,
		[CategoryIcon("coui://uil/Colored/ServiceBuilding.svg")]
		Buildings_Services,
		[CategoryIcon("coui://uil/Colored/HouseAlternative.svg")]
		Buildings_Miscellaneous,

		[Obsolete("Use PrefabCategory", true)]
		ServiceBuildings = PrefabCategory.ServiceBuildings,
		[CategoryIcon("Media/Game/Icons/Parking.svg")]
		ServiceBuildings_Roads,
		[CategoryIcon("Media/Game/Icons/Electricity.svg")]
		ServiceBuildings_Electricity,
		[CategoryIcon("Media/Game/Icons/Water.svg")]
		ServiceBuildings_Water,
		[CategoryIcon("Media/Game/Icons/Healthcare.svg")]
		ServiceBuildings_Health,
		[CategoryIcon("Media/Game/Icons/Police.svg")]
		ServiceBuildings_Police,
		[CategoryIcon("Media/Game/Icons/FireSafety.svg")]
		ServiceBuildings_Fire,
		[CategoryIcon("Media/Game/Icons/Education.svg")]
		ServiceBuildings_EducationResearch,
		[CategoryIcon("Media/Game/Icons/Communications.svg")]
		ServiceBuildings_Communications,
		[CategoryIcon("Media/Game/Icons/Garbage.svg")]
		ServiceBuildings_Garbage,
		[CategoryIcon("Media/Game/Icons/Transportation.svg")]
		ServiceBuildings_Transportation,
		[CategoryIcon("Media/Game/Icons/Landscaping.svg")]
		ServiceBuildings_Landscaping,
		[CategoryIcon("Media/Game/Icons/ParksAndRecreation.svg")]
		ServiceBuildings_Parks,
		[CategoryIcon("coui://uil/Standard/StarAll.svg")]
		ServiceBuildings_Misc,

		[Obsolete("Use PrefabCategory", true)]
		Networks = PrefabCategory.Networks,
		[CategoryIcon("coui://uil/Colored/Road.svg")]
		Networks_Roads,
		[CategoryIcon("coui://uil/Colored/Highway.svg")]
		Networks_Highways,
		[CategoryIcon("coui://uil/Colored/RailTrack.svg")]
		Networks_Tracks,
		[CategoryIcon("coui://uil/Colored/Bridge.svg")]
		Networks_Bridges,
		[CategoryIcon("coui://uil/Colored/Intersection.svg")]
		Networks_Intersections,
		[CategoryIcon("coui://uil/Colored/PedestrianPath.svg")]
		Networks_Paths,
		[CategoryIcon("coui://uil/Colored/Lanes.svg")]
		Networks_Lanes,
		[CategoryIcon("coui://uil/Colored/BusShelter.svg")]
		Networks_Stops,
		[CategoryIcon("coui://uil/Colored/Pillar.svg")]
		Networks_Pillars,
		// Appended rather than inserted, because these values are ordinal and the
		// blocks below only survive that because each opens with an explicit
		// `= PrefabCategory.X`. CatalogIndex lays them out only inside (Networks, +100).
		[CategoryIcon("Media/Game/Icons/Ship.svg")]
		Networks_Waterways,
		[CategoryIcon("Media/Game/Icons/Electricity.svg")]
		Networks_PowerLines,
		[CategoryIcon("Media/Game/Icons/Water.svg")]
		Networks_Pipes,
		// Applied to a road rather than drawn: traffic lights, crosswalks, bike
		// lanes, sound barriers. Vanilla files them under Roads > Services.
		[CategoryIcon("Media/Game/Icons/Roads.svg")]
		Networks_Upgrades,
		// Bus, tram, subway, train, ship and airplane lines. Drawn across the
		// network rather than being part of it.
		[CategoryIcon("Media/Game/Icons/TransportationOverview.svg")]
		Networks_Routes,

		[Obsolete("Use PrefabCategory", true)]
		Trees = PrefabCategory.Trees,
		[CategoryIcon("coui://uil/Colored/TreeVanilla.svg")]
		Trees_Trees,
		[CategoryIcon("coui://uil/Colored/Bush.svg")]
		Trees_Shrubs,
		[CategoryIcon("Media/Game/Resources/Stone.svg")]
		Trees_Rocks,
		[CategoryIcon("coui://uil/Colored/FlowerPot.svg")]
		Trees_Props,
		[CategoryIcon("coui://uil/Colored/MarkerSpawner.svg")]
		Trees_Spawners,

		[Obsolete("Use PrefabCategory", true)]
		Props = PrefabCategory.Props,
		[CategoryIcon("coui://uil/Colored/FurnitureIso.svg")]
		Props_Misc,
		[CategoryIcon("Media/Game/Icons/LotTool.svg")]
		Props_Surfaces,
		[CategoryIcon("coui://uil/Colored/PropResidential.svg")]
		Props_Residential,
		[CategoryIcon("coui://uil/Colored/PropCommercial.svg")]
		Props_Commercial,
		[CategoryIcon("coui://uil/Colored/PropIndustrial.svg")]
		Props_Industrial,
		[CategoryIcon("coui://uil/Colored/HealthcareServiceProps.svg")]
		Props_Service,
		[CategoryIcon("coui://uil/Colored/FenceIsometric.svg")]
		Props_Fences,
		[CategoryIcon("coui://uil/Colored/BenchAndParkProps.svg")]
		Props_Park,
		[CategoryIcon("coui://uil/Colored/Decals.svg")]
		Props_Decals,
		[CategoryIcon("coui://uil/Colored/LampProps.svg")]
		Props_Lights,
		[CategoryIcon("coui://uil/Colored/Billboard.svg")]
		Props_Branding,
		[CategoryIcon("Media/Game/Icons/Lighting.svg")]
		Props_Road,

		// The zone families, which are the game's own: ZoneData.m_AreaType plus
		// ZoneFlags.Office. Same icons as the Buildings_* rows deliberately — a
		// residential zone and a residential building are one idea at two scales.
		[Obsolete("Use PrefabCategory", true)]
		Zones = PrefabCategory.Zones,
		[CategoryIcon("Media/Game/Icons/ZoneResidential.svg")]
		Zones_Residential,
		[CategoryIcon("Media/Game/Icons/ZoneCommercial.svg")]
		Zones_Commercial,
		[CategoryIcon("Media/Game/Icons/ZoneIndustrial.svg")]
		Zones_Industrial,
		[CategoryIcon("Media/Game/Icons/ZoneOffice.svg")]
		Zones_Office,
		[CategoryIcon("Media/Game/Icons/ZoneExtractors.svg")]
		Zones_Extractors,
		// Zones whose AreaType the data does not distinguish at all. IndexZones
		// drops these from its own catalog; the index keeps them, because being
		// unclassifiable is not a reason to be unarmable.
		[CategoryIcon("coui://uil/Standard/StarAll.svg")]
		Zones_Misc,
	}
}
