using System;

namespace BetterBuildingMenu.Domain.Enums
{
	public enum PrefabSubCategory
	{
		[CategoryIcon("coui://betterbuildingmenu/Icons/Standard/StarAll.svg")]
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
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/ServiceBuilding.svg")]
		Buildings_Services,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/HouseAlternative.svg")]
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
		[CategoryIcon("coui://betterbuildingmenu/Icons/Standard/StarAll.svg")]
		ServiceBuildings_Misc,

		[Obsolete("Use PrefabCategory", true)]
		Networks = PrefabCategory.Networks,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Road.svg")]
		Networks_Roads,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Highway.svg")]
		Networks_Highways,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/RailTrack.svg")]
		Networks_Tracks,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Bridge.svg")]
		Networks_Bridges,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Intersection.svg")]
		Networks_Intersections,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/PedestrianPath.svg")]
		Networks_Paths,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Lanes.svg")]
		Networks_Lanes,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/BusShelter.svg")]
		Networks_Stops,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Pillar.svg")]
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
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/TreeVanilla.svg")]
		Trees_Trees,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Bush.svg")]
		Trees_Shrubs,
		[CategoryIcon("Media/Game/Resources/Stone.svg")]
		Trees_Rocks,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/FlowerPot.svg")]
		Trees_Props,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/MarkerSpawner.svg")]
		Trees_Spawners,

		[Obsolete("Use PrefabCategory", true)]
		Props = PrefabCategory.Props,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/FurnitureIso.svg")]
		Props_Misc,
		[CategoryIcon("Media/Game/Icons/LotTool.svg")]
		Props_Surfaces,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/PropResidential.svg")]
		Props_Residential,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/PropCommercial.svg")]
		Props_Commercial,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/PropIndustrial.svg")]
		Props_Industrial,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/HealthcareServiceProps.svg")]
		Props_Service,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/FenceIsometric.svg")]
		Props_Fences,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/BenchAndParkProps.svg")]
		Props_Park,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Decals.svg")]
		Props_Decals,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/LampProps.svg")]
		Props_Lights,
		[CategoryIcon("coui://betterbuildingmenu/Icons/Colored/Billboard.svg")]
		Props_Branding,
		[CategoryIcon("Media/Game/Icons/Lighting.svg")]
		Props_Road,

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
		[CategoryIcon("coui://betterbuildingmenu/Icons/Standard/StarAll.svg")]
		Zones_Misc,
	}
}
