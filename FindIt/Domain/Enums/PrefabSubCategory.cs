using System;

namespace FindItBuildingMenu.Domain.Enums
{
	public enum PrefabSubCategory
	{
		[CategoryIcon("coui://finditbuildingmenu/Icons/Standard/StarAll.svg")]
		Any = PrefabCategory.Any,

		[Obsolete("Use PrefabCategory", true)]
		Buildings = PrefabCategory.Buildings,
		[CategoryIcon("Media/Game/Icons/ZoneResidential.svg")]
		Buildings_Residential,
		[CategoryIcon("coui://finditbuildingmenu/ZoneResidentialMixed.svg")]
		Buildings_Mixed,
		[CategoryIcon("Media/Game/Icons/ZoneCommercial.svg")]
		Buildings_Commercial,
		[CategoryIcon("Media/Game/Icons/ZoneIndustrial.svg")]
		Buildings_Industrial,
		[CategoryIcon("Media/Game/Icons/ZoneOffice.svg")]
		Buildings_Office,
		[CategoryIcon("Media/Game/Icons/ZoneExtractors.svg")]
		Buildings_Specialized,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/ServiceBuilding.svg")]
		Buildings_Services,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/HouseAlternative.svg")]
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
		[CategoryIcon("coui://finditbuildingmenu/Icons/Standard/StarAll.svg")]
		ServiceBuildings_Misc,

		[Obsolete("Use PrefabCategory", true)]
		Networks = PrefabCategory.Networks,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Road.svg")]
		Networks_Roads,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Highway.svg")]
		Networks_Highways,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/RailTrack.svg")]
		Networks_Tracks,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Bridge.svg")]
		Networks_Bridges,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Intersection.svg")]
		Networks_Intersections,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/PedestrianPath.svg")]
		Networks_Paths,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Lanes.svg")]
		Networks_Lanes,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/BusShelter.svg")]
		Networks_Stops,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Pillar.svg")]
		Networks_Pillars,
		// The five below close gaps the vanilla-menu coverage report found: every
		// one of them is a network the build menu offers and no processor reached.
		// Appended rather than inserted because these values are ordinal, and the
		// blocks below only survive that because each opens with an explicit
		// `= PrefabCategory.X`. AddAllCategories requires them to stay inside
		// (Networks, Networks + 100).
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
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/TreeVanilla.svg")]
		Trees_Trees,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Bush.svg")]
		Trees_Shrubs,
		[CategoryIcon("Media/Game/Resources/Stone.svg")]
		Trees_Rocks,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/FlowerPot.svg")]
		Trees_Props,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/MarkerSpawner.svg")]
		Trees_Spawners,

		[Obsolete("Use PrefabCategory", true)]
		Props = PrefabCategory.Props,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/FurnitureIso.svg")]
		Props_Misc,
		[CategoryIcon("Media/Game/Icons/LotTool.svg")]
		Props_Surfaces,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/PropResidential.svg")]
		Props_Residential,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/PropCommercial.svg")]
		Props_Commercial,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/PropIndustrial.svg")]
		Props_Industrial,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/HealthcareServiceProps.svg")]
		Props_Service,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/FenceIsometric.svg")]
		Props_Fences,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/BenchAndParkProps.svg")]
		Props_Park,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Decals.svg")]
		Props_Decals,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/LampProps.svg")]
		Props_Lights,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Billboard.svg")]
		Props_Branding,
		[CategoryIcon("Media/Game/Icons/Lighting.svg")]
		Props_Road,

		[Obsolete("Use PrefabCategory", true)]
		Vehicles = PrefabCategory.Vehicles,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/GenericVehicle.svg")]
		Vehicles_Residential,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/Motorbike.svg")]
		Vehicles_Bikes,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/DeliveryVan.svg")]
		Vehicles_Industrial,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/ServiceVehicles.svg")]
		Vehicles_Services,
		[CategoryIcon("Media/Game/Icons/Bus.svg")]
		Vehicles_Bus,
		[CategoryIcon("Media/Game/Icons/Train.svg")]
		Vehicles_Train,
		[CategoryIcon("Media/Game/Icons/Ship.svg")]
		Vehicles_Ship,
		[CategoryIcon("Media/Game/Icons/Airplane.svg")]
		Vehicles_Plane,
		[CategoryIcon("coui://finditbuildingmenu/Icons/Colored/GenericVehicles.svg")]
		Vehicles_Misc,

		// The zone families, which are the game's own: ZoneData.m_AreaType plus
		// ZoneFlags.Office is what it switches on, and ZonePrefab derives its
		// "ZonesOffice"/"Zones{AreaType}" tags from the same two fields.
		//
		// Same icons as the Buildings_* rows above, deliberately. A residential
		// ZONE and a residential BUILDING are the same idea at two scales, and
		// giving them different glyphs would invent a distinction the game does
		// not draw.
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
		[CategoryIcon("coui://finditbuildingmenu/Icons/Standard/StarAll.svg")]
		Zones_Misc,
	}
}
