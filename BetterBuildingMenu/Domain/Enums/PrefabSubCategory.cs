using System;

namespace BetterBuildingMenu.Domain.Enums
{
	public enum PrefabSubCategory
	{
		[CategoryIcon("coui://uil/Standard/StarAll.svg")]
		Any = PrefabCategory.Any,

		[Obsolete("Use PrefabCategory", true)]
		Buildings = PrefabCategory.Buildings,
		[CategoryIcon(ZoningIcons.Residential)]
		Buildings_Residential,
		[CategoryIcon("coui://betterbuildingmenu/ZoneResidentialMixed.svg")]
		Buildings_Mixed,
		[CategoryIcon(ZoningIcons.Commercial)]
		Buildings_Commercial,
		[CategoryIcon(ZoningIcons.Industrial)]
		Buildings_Industrial,
		[CategoryIcon(ZoningIcons.Office)]
		Buildings_Office,
		[CategoryIcon(ZoningIcons.Extractors)]
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
		// The game builds both with its Bridge component (quays with the Quay build style),
		// so they are split off Bridges: see BridgeNets.
		[CategoryIcon("coui://uil/Colored/RoadUpgradeQuay.svg")]
		Networks_Quays,
		[CategoryIcon("Media/Game/Icons/LeisurePier01Large.svg")]
		Networks_Piers,
		// Bike and pedestrian bridges: pathways the game raises with its Bridge component.
		[CategoryIcon("Media/Game/Icons/ArcBikeBridge.svg")]
		Networks_PathBridges,

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
		[CategoryIcon(ZoningIcons.Residential)]
		Zones_Residential,
		[CategoryIcon(ZoningIcons.Commercial)]
		Zones_Commercial,
		[CategoryIcon(ZoningIcons.Industrial)]
		Zones_Industrial,
		[CategoryIcon(ZoningIcons.Office)]
		Zones_Office,
		[CategoryIcon(ZoningIcons.Extractors)]
		Zones_Extractors,
		// Zones whose AreaType the data does not distinguish at all. IndexZones
		// drops these from its own catalog; the index keeps them, because being
		// unclassifiable is not a reason to be unarmable.
		[CategoryIcon("coui://uil/Standard/StarAll.svg")]
		Zones_Misc,
	}

	/// <summary>Where a subcategory sits: each category's subcategories take the hundred values above it.</summary>
	/// <remarks>Any is -1 and lies in no hundred, so a caller for whom Any is legal keeps the
	/// (category, subcategory) pair rather than deriving one from the other.</remarks>
	public static class PrefabSubCategories
	{
		/// <summary>The category whose hundred this subcategory lies in.</summary>
		public static PrefabCategory CategoryOf(this PrefabSubCategory subCategory) =>
			subCategory is PrefabSubCategory.Any
				? throw new ArgumentOutOfRangeException(nameof(subCategory), "Any belongs to every category.")
				: (PrefabCategory)((int)subCategory - (int)subCategory % 100);

		/// <summary>Whether this subcategory is one of the category's own.</summary>
		public static bool Contains(this PrefabCategory category, PrefabSubCategory subCategory) =>
			(int)subCategory > (int)category && (int)subCategory < (int)category + 100;
	}
}
