using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Every group dimension's keys, headings and order, and the ids that name none, over a set
	/// that reaches each branch: transit tiers, density, school levels, development branches, bands at
	/// and past their edges, and blank values.</summary>
	public sealed class GroupDimensionTableTests
	{
		private static BuildingCatalogEntry Row(int id, string prefab, string category, string subCategory, string? menu, string? uiCategory) =>
			TestEntries.Make(id, prefab, prefab, category, subCategory) with { UiMenu = menu, UiCategory = uiCategory };

		internal static readonly BuildingCatalogEntry[] Set =
		{
			Row(1, "TrainTrack", "Networks", "Networks_Tracks", "Transportation", "TransportationTrain")
				with { UiCategoryPriority = 10, UiCategoryTab = 2, Provenance = "Vanilla", UnlockMilestone = 2 },
			Row(2, "TrainStation", "ServiceBuildings", "ServiceBuildings_Transportation", "Transportation", "TransportationTrain")
				with { UiCategoryPriority = 10, UiCategoryTab = 2, BuildingType = "Station", LotWidth = 4, LotDepth = 8, ConstructionCost = 30000, UnlockMilestone = 3 },
			Row(3, "TrainDepot", "ServiceBuildings", "ServiceBuildings_Transportation", "Transportation", "TransportationTrain")
				with { UiCategoryPriority = 10, UiCategoryTab = 2, BuildingType = "Depot", LotWidth = 6, LotDepth = 6, ConstructionCost = 25000 },
			Row(4, "BusStop", "Networks", "Networks_Stops", "Transportation", "TransportationBus")
				with { UiCategoryPriority = -5, UiCategoryTab = 0, BuildingType = "Stop", LotWidth = 1, LotDepth = 2, ConstructionCost = 4999 },
			Row(5, "BusShelter", "Networks", "Networks_Stops", "Transportation", "TransportationBus")
				with { UiCategoryPriority = -5, UiCategoryTab = 0, Theme = "European", SubCategoryLabel = "Stops" },
			Row(6, "CargoHarbor", "ServiceBuildings", "ServiceBuildings_Transportation", "Transportation", "TransportationShip")
				with { UiCategoryPriority = 30, BuildingType = "CargoStation", DlcId = "1", Provenance = "Vanilla" },
			Row(7, "Seaway", "Networks", "Networks_Waterways", "Transportation", "TransportationShip")
				with { UiCategoryPriority = 30 },
			Row(8, "BusLane", "Networks", "Networks_Roads", "Transportation", "TransportationBus")
				with { UiCategoryPriority = -5, UiCategoryTab = 0 },
			Row(9, "LowHouse", "Buildings", "Buildings_Residential", "Zones", "ZonesResidential")
				with { ZoneType = ZoneTypeFilter.Low, LotWidth = 2, LotDepth = 2, Theme = "NorthAmerican", BuildingType = "Residential", ConstructionCost = 5000 },
			Row(10, "SignatureTower", "Buildings", "Buildings_Residential", "Zones", "ZonesResidential")
				with { ZoneType = ZoneTypeFilter.Signature, UnlockMilestone = 5, LotWidth = 7, LotDepth = 7, ConstructionCost = 100000 },
			Row(11, "MixedBlock", "Buildings", "Buildings_Residential", "Zones", "ZonesResidential")
				with { ZoneType = ZoneTypeFilter.Mixed, CategoryLabel = "Built", SubCategoryLabel = "Housing" },
			Row(12, "Elementary", "ServiceBuildings", "ServiceBuildings_Education", "Education & Research", "Education")
				with { EducationLevel = 1, BuildingType = "School", DevTreeBranch = "Elementary", DevTreeBranchDepth = 0 },
			Row(13, "University", "ServiceBuildings", "ServiceBuildings_Education", "Education & Research", "Education")
				with { EducationLevel = 3, DevTreeBranch = "University", DevTreeBranchDepth = 2 },
			Row(14, "ResearchLab", "ServiceBuildings", "ServiceBuildings_Research", "Education & Research", "EducationResearch")
				with { EducationLevel = 5, BuildingType = "ResearchFacility", UnlockMilestone = 1 },
			Row(15, "Blank", "  ", "", "", "")
				with { DevTreeBranch = "  ", Theme = "  ", DlcId = "  ", ConstructionCost = double.NaN, LotWidth = 0, LotDepth = 0, UnlockMilestone = -1 },
			Row(16, "GasPlant", "ServiceBuildings", "ServiceBuildings_Electricity", "Electricity", "Electricity")
				with { DevTreeBranch = "Gas Power Plant", DevTreeBranchDepth = 1, ConstructionCost = 1e9, EducationLevel = 0, Provenance = "Custom" },
		};

		internal static readonly IReadOnlyList<string> MilestoneNames = new[] { "Founding", "", "Small Village" };

		internal static readonly IReadOnlyDictionary<int, string> SchoolTierNames =
			new Dictionary<int, string> { [1] = "Elementary (game)", [3] = "College (game)" };

		/// <summary>The dimensions the picker offers, then ids that name none, in other casings and padded.</summary>
		internal static readonly string?[] Inputs =
		{
			"menuCategory", "category", "subCategory", "role", "schoolTier", "progression", "development",
			"theme", "source", "density", "footprint", "cost", "none",
			"", "   ", null, "bogus", "MENUCATEGORY", " theme ", "NONE",
		};

		/// <summary>Each row's keys and headings under one dimension, with and without the game's names.</summary>
		internal static string KeysAndLabelsOf(string? dimension)
		{
			var grouping = BuildingCatalogGrouping.Find(dimension);

			return string.Join("; ", Set.Select(entry =>
			{
				var named = grouping.Labels(entry, MilestoneNames, SchoolTierNames);
				var plain = grouping.Labels(entry);

				return Escape(
					grouping.PrimaryKey(entry)
					+ "|" + grouping.SecondaryKey(entry)
					+ "|" + string.Join("/", named.Path) + "|" + (named.LabelId ?? "null")
					+ "|" + string.Join("/", plain.Path) + "|" + (plain.LabelId ?? "null"));
			}));
		}

		/// <summary>The set's order grouped by one dimension, by name within each group.</summary>
		internal static string OrderOf(string? dimension) =>
			string.Join(",", BuildingCatalogQueryEngine
				.Query(Set, new BuildingCatalogQuery(GroupBy: dimension!, SortColumn: "Name", Limit: 100))
				.Items.Select(entry => entry.PrefabName));

		/// <summary>The headings CatalogView stamps on the page, telling an absent path from an empty one.</summary>
		internal static string StampsOf(string? dimension) =>
			string.Join("; ", new CatalogView(
					Set,
					new BuildingCatalogQuery(GroupBy: dimension!, SortColumn: "Name", Limit: 100),
					milestoneNames: MilestoneNames,
					schoolTierNames: SchoolTierNames)
				.Page.Items.Select(entry => Escape(
					entry.PrefabName + ":"
					+ (entry.GroupPath is null ? "null" : "[" + string.Join("/", entry.GroupPath) + "]")
					+ "|" + (entry.GroupLabelId ?? "null"))));

		/// <summary>Anything outside printable ASCII as a C# escape, so an expected value reads in source.</summary>
		internal static string Escape(string value)
		{
			var escaped = new StringBuilder(value.Length);

			foreach (var c in value)
			{
				if (c is >= ' ' and <= '~' && c != '\\')
				{
					escaped.Append(c);
				}
				else
				{
					escaped.Append("\\u").Append(((int)c).ToString("X4", System.Globalization.CultureInfo.InvariantCulture));
				}
			}

			return escaped.ToString();
		}

		[Theory]
		[InlineData("menuCategory", @"21474836580000000002\u0000TransportationTrain|s0Networks_Tracks|Train/Networks Tracks|TransportationTrain|Train/Networks Tracks|TransportationTrain; 21474836580000000002\u0000TransportationTrain|s1|Train/Stations|TransportationTrain|Train/Stations|TransportationTrain; 21474836580000000002\u0000TransportationTrain|s1|Train/Stations|TransportationTrain|Train/Stations|TransportationTrain; 21474836430000000000\u0000TransportationBus|s2|Bus/Networks Stops|TransportationBus|Bus/Networks Stops|TransportationBus; 21474836430000000000\u0000TransportationBus|s2|Bus/Stops|TransportationBus|Bus/Stops|TransportationBus; 21474836782147483647\u0000TransportationShip|s4|Ship/Cargo Stations|TransportationShip|Ship/Cargo Stations|TransportationShip; 21474836782147483647\u0000TransportationShip|s0Networks_Waterways|Ship/Networks Waterways|TransportationShip|Ship/Networks Waterways|TransportationShip; 21474836430000000000\u0000TransportationBus|s0Networks_Roads|Bus/Networks Roads|TransportationBus|Bus/Networks Roads|TransportationBus; 21474836482147483647\u0000ZonesResidential|d0|Residential/Low Density|ZonesResidential|Residential/Low Density|ZonesResidential; 21474836482147483647\u0000ZonesResidential|m005|Residential/Milestone 5|ZonesResidential|Residential/Milestone 5|ZonesResidential; 21474836482147483647\u0000ZonesResidential|d3|Residential/Mixed Housing|ZonesResidential|Residential/Mixed Housing|ZonesResidential; 21474836482147483647\u0000Education|b000Elementary|Education/Elementary|Education|Education/Elementary|Education; 21474836482147483647\u0000Education|b002University|Education/University|Education|Education/University|Education; 21474836482147483647\u0000EducationResearch|m001|Education Research/Milestone 1|EducationResearch|Education Research/Milestone 1|EducationResearch; \uFFFD|m-001|Other/Other|null|Other/Other|null; 21474836482147483647\u0000Electricity|b001Gas Power Plant|Electricity/Gas Power Plant|Electricity|Electricity/Gas Power Plant|Electricity", "BusLane,BusShelter,BusStop,Elementary,University,ResearchLab,GasPlant,LowHouse,MixedBlock,SignatureTower,TrainTrack,TrainDepot,TrainStation,Seaway,CargoHarbor,Blank")]
		[InlineData("category", @"Networks|Networks_Tracks|Networks/Networks Tracks|null|Networks/Networks Tracks|null; ServiceBuildings|ServiceBuildings_Transportation|Service Buildings/Service Buildings Transportation|null|Service Buildings/Service Buildings Transportation|null; ServiceBuildings|ServiceBuildings_Transportation|Service Buildings/Service Buildings Transportation|null|Service Buildings/Service Buildings Transportation|null; Networks|Networks_Stops|Networks/Networks Stops|null|Networks/Networks Stops|null; Networks|Networks_Stops|Networks/Stops|null|Networks/Stops|null; ServiceBuildings|ServiceBuildings_Transportation|Service Buildings/Service Buildings Transportation|null|Service Buildings/Service Buildings Transportation|null; Networks|Networks_Waterways|Networks/Networks Waterways|null|Networks/Networks Waterways|null; Networks|Networks_Roads|Networks/Networks Roads|null|Networks/Networks Roads|null; Buildings|Buildings_Residential|Buildings/Buildings Residential|null|Buildings/Buildings Residential|null; Buildings|Buildings_Residential|Buildings/Buildings Residential|null|Buildings/Buildings Residential|null; Buildings|Buildings_Residential|Built/Housing|null|Built/Housing|null; ServiceBuildings|ServiceBuildings_Education|Service Buildings/Service Buildings Education|null|Service Buildings/Service Buildings Education|null; ServiceBuildings|ServiceBuildings_Education|Service Buildings/Service Buildings Education|null|Service Buildings/Service Buildings Education|null; ServiceBuildings|ServiceBuildings_Research|Service Buildings/Service Buildings Research|null|Service Buildings/Service Buildings Research|null; \uFFFD|\uFFFD|Other/Other|null|Other/Other|null; ServiceBuildings|ServiceBuildings_Electricity|Service Buildings/Service Buildings Electricity|null|Service Buildings/Service Buildings Electricity|null", "LowHouse,MixedBlock,SignatureTower,BusLane,BusShelter,BusStop,TrainTrack,Seaway,Elementary,University,GasPlant,ResearchLab,CargoHarbor,TrainDepot,TrainStation,Blank")]
		[InlineData("subCategory", @"Networks_Tracks||Networks Tracks|null|Networks Tracks|null; ServiceBuildings_Transportation||Service Buildings Transportation|null|Service Buildings Transportation|null; ServiceBuildings_Transportation||Service Buildings Transportation|null|Service Buildings Transportation|null; Networks_Stops||Networks Stops|null|Networks Stops|null; Networks_Stops||Stops|null|Stops|null; ServiceBuildings_Transportation||Service Buildings Transportation|null|Service Buildings Transportation|null; Networks_Waterways||Networks Waterways|null|Networks Waterways|null; Networks_Roads||Networks Roads|null|Networks Roads|null; Buildings_Residential||Buildings Residential|null|Buildings Residential|null; Buildings_Residential||Buildings Residential|null|Buildings Residential|null; Buildings_Residential||Housing|null|Housing|null; ServiceBuildings_Education||Service Buildings Education|null|Service Buildings Education|null; ServiceBuildings_Education||Service Buildings Education|null|Service Buildings Education|null; ServiceBuildings_Research||Service Buildings Research|null|Service Buildings Research|null; \uFFFD||Other|null|Other|null; ServiceBuildings_Electricity||Service Buildings Electricity|null|Service Buildings Electricity|null", "LowHouse,MixedBlock,SignatureTower,BusLane,BusShelter,BusStop,TrainTrack,Seaway,Elementary,University,GasPlant,ResearchLab,CargoHarbor,TrainDepot,TrainStation,Blank")]
		[InlineData("role", @"\uFFFD||Other|null|Other|null; Station||Station|null|Station|null; Depot||Depot|null|Depot|null; Stop||Stop|null|Stop|null; \uFFFD||Other|null|Other|null; CargoStation||Cargo Station|null|Cargo Station|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; Residential||Residential|null|Residential|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; School||School|null|School|null; \uFFFD||Other|null|Other|null; ResearchFacility||Research Facility|null|Research Facility|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null", "CargoHarbor,TrainDepot,ResearchLab,LowHouse,Elementary,TrainStation,BusStop,Blank,BusLane,BusShelter,GasPlant,MixedBlock,Seaway,SignatureTower,TrainTrack,University")]
		[InlineData("schoolTier", @"9||Train|TransportationTrain|Train|TransportationTrain; 9||Train|TransportationTrain|Train|TransportationTrain; 9||Train|TransportationTrain|Train|TransportationTrain; 9||Bus|TransportationBus|Bus|TransportationBus; 9||Bus|TransportationBus|Bus|TransportationBus; 9||Ship|TransportationShip|Ship|TransportationShip; 9||Ship|TransportationShip|Ship|TransportationShip; 9||Bus|TransportationBus|Bus|TransportationBus; 9||Residential|ZonesResidential|Residential|ZonesResidential; 9||Residential|ZonesResidential|Residential|ZonesResidential; 9||Residential|ZonesResidential|Residential|ZonesResidential; 1||Elementary (game)|null|Elementary School|null; 3||College (game)|null|College|null; 9||Education Research|EducationResearch|Education Research|EducationResearch; 9||Other|null|Other|null; 9||Electricity|Electricity|Electricity|Electricity", "Elementary,University,Blank,BusLane,BusShelter,BusStop,CargoHarbor,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack")]
		[InlineData("progression", @"002||Small Village|null|Milestone 2|null; 003||Milestone 3|null|Milestone 3|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 005||Milestone 5|null|Milestone 5|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 000||Founding|null|From the start|null; 001||Milestone 1|null|Milestone 1|null; -001||Other|null|Other|null; 000||Founding|null|From the start|null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,Seaway,TrainDepot,University,ResearchLab,TrainTrack,TrainStation,SignatureTower")]
		[InlineData("development", @"\uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; 000Elementary||Elementary|null|Elementary|null; 002University||University|null|University|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; 001Gas Power Plant||Gas Power Plant|null|Gas Power Plant|null", "Elementary,GasPlant,University,Blank,BusLane,BusShelter,BusStop,CargoHarbor,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack")]
		[InlineData("theme", @"\uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; European||European|null|European|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; NorthAmerican||North American|null|North American|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null", "BusShelter,LowHouse,Blank,BusLane,BusStop,CargoHarbor,Elementary,GasPlant,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("source", @"Vanilla||Vanilla|null|Vanilla|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; 1||1|null|1|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; Custom||Custom|null|Custom|null", "CargoHarbor,GasPlant,TrainTrack,Blank,BusLane,BusShelter,BusStop,Elementary,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,University")]
		[InlineData("density", @"9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 0||Low Density|null|Low Density|null; 6||Signature|null|Signature|null; 3||Mixed Housing|null|Mixed Housing|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null", "LowHouse,MixedBlock,SignatureTower,Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,ResearchLab,Seaway,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("footprint", @"0||2\u00D72 and under|null|2\u00D72 and under|null; 3||Larger than 6\u00D76|null|Larger than 6\u00D76|null; 2||6\u00D76 and under|null|6\u00D76 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 3||Larger than 6\u00D76|null|Larger than 6\u00D76|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 0||2\u00D72 and under|null|2\u00D72 and under|null; 9||Other|null|Other|null; 0||2\u00D72 and under|null|2\u00D72 and under|null", "BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,TrainTrack,University,TrainDepot,SignatureTower,TrainStation,Blank")]
		[InlineData("cost", @"9||Other|null|Other|null; 2||\u20A125k\u2013\u20A1100k|null|\u20A125k\u2013\u20A1100k|null; 2||\u20A125k\u2013\u20A1100k|null|\u20A125k\u2013\u20A1100k|null; 0||\u20A10\u2013\u20A15k|null|\u20A10\u2013\u20A15k|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 1||\u20A15k\u2013\u20A125k|null|\u20A15k\u2013\u20A125k|null; 3||\u20A1100k+|null|\u20A1100k+|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 9||Other|null|Other|null; 3||\u20A1100k+|null|\u20A1100k+|null", "BusStop,LowHouse,TrainDepot,TrainStation,GasPlant,SignatureTower,Blank,BusLane,BusShelter,CargoHarbor,Elementary,MixedBlock,ResearchLab,Seaway,TrainTrack,University")]
		[InlineData("none", @"|||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("", @"|||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("   ", @"|||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData(null, @"|||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("bogus", @"|||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("MENUCATEGORY", @"21474836580000000002\u0000TransportationTrain|s0Networks_Tracks|Train/Networks Tracks|TransportationTrain|Train/Networks Tracks|TransportationTrain; 21474836580000000002\u0000TransportationTrain|s1|Train/Stations|TransportationTrain|Train/Stations|TransportationTrain; 21474836580000000002\u0000TransportationTrain|s1|Train/Stations|TransportationTrain|Train/Stations|TransportationTrain; 21474836430000000000\u0000TransportationBus|s2|Bus/Networks Stops|TransportationBus|Bus/Networks Stops|TransportationBus; 21474836430000000000\u0000TransportationBus|s2|Bus/Stops|TransportationBus|Bus/Stops|TransportationBus; 21474836782147483647\u0000TransportationShip|s4|Ship/Cargo Stations|TransportationShip|Ship/Cargo Stations|TransportationShip; 21474836782147483647\u0000TransportationShip|s0Networks_Waterways|Ship/Networks Waterways|TransportationShip|Ship/Networks Waterways|TransportationShip; 21474836430000000000\u0000TransportationBus|s0Networks_Roads|Bus/Networks Roads|TransportationBus|Bus/Networks Roads|TransportationBus; 21474836482147483647\u0000ZonesResidential|d0|Residential/Low Density|ZonesResidential|Residential/Low Density|ZonesResidential; 21474836482147483647\u0000ZonesResidential|m005|Residential/Milestone 5|ZonesResidential|Residential/Milestone 5|ZonesResidential; 21474836482147483647\u0000ZonesResidential|d3|Residential/Mixed Housing|ZonesResidential|Residential/Mixed Housing|ZonesResidential; 21474836482147483647\u0000Education|b000Elementary|Education/Elementary|Education|Education/Elementary|Education; 21474836482147483647\u0000Education|b002University|Education/University|Education|Education/University|Education; 21474836482147483647\u0000EducationResearch|m001|Education Research/Milestone 1|EducationResearch|Education Research/Milestone 1|EducationResearch; \uFFFD|m-001|Other/Other|null|Other/Other|null; 21474836482147483647\u0000Electricity|b001Gas Power Plant|Electricity/Gas Power Plant|Electricity|Electricity/Gas Power Plant|Electricity", "BusLane,BusShelter,BusStop,Elementary,University,ResearchLab,GasPlant,LowHouse,MixedBlock,SignatureTower,TrainTrack,TrainDepot,TrainStation,Seaway,CargoHarbor,Blank")]
		[InlineData(" theme ", @"\uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; European||European|null|European|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; NorthAmerican||North American|null|North American|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null; \uFFFD||Other|null|Other|null", "BusShelter,LowHouse,Blank,BusLane,BusStop,CargoHarbor,Elementary,GasPlant,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		[InlineData("NONE", @"|||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null; |||null||null", "Blank,BusLane,BusShelter,BusStop,CargoHarbor,Elementary,GasPlant,LowHouse,MixedBlock,ResearchLab,Seaway,SignatureTower,TrainDepot,TrainStation,TrainTrack,University")]
		public void EachDimensionKeysLabelsAndOrdersTheSet(string? dimension, string keysAndLabels, string order)
		{
			Assert.Equal(keysAndLabels, KeysAndLabelsOf(dimension));
			Assert.Equal(order, OrderOf(dimension));
		}

		[Theory]
		[InlineData("menuCategory", @"BusLane:[Bus/Networks Roads]|TransportationBus; BusShelter:[Bus/Stops]|TransportationBus; BusStop:[Bus/Networks Stops]|TransportationBus; Elementary:[Education/Elementary]|Education; University:[Education/University]|Education; ResearchLab:[Education Research/Milestone 1]|EducationResearch; GasPlant:[Electricity/Gas Power Plant]|Electricity; LowHouse:[Residential/Low Density]|ZonesResidential; MixedBlock:[Residential/Mixed Housing]|ZonesResidential; SignatureTower:[Residential/Milestone 5]|ZonesResidential; TrainTrack:[Train/Networks Tracks]|TransportationTrain; TrainDepot:[Train/Stations]|TransportationTrain; TrainStation:[Train/Stations]|TransportationTrain; Seaway:[Ship/Networks Waterways]|TransportationShip; CargoHarbor:[Ship/Cargo Stations]|TransportationShip; Blank:[Other/Other]|null")]
		[InlineData("category", @"LowHouse:[Buildings/Buildings Residential]|null; MixedBlock:[Built/Housing]|null; SignatureTower:[Buildings/Buildings Residential]|null; BusLane:[Networks/Networks Roads]|null; BusShelter:[Networks/Stops]|null; BusStop:[Networks/Networks Stops]|null; TrainTrack:[Networks/Networks Tracks]|null; Seaway:[Networks/Networks Waterways]|null; Elementary:[Service Buildings/Service Buildings Education]|null; University:[Service Buildings/Service Buildings Education]|null; GasPlant:[Service Buildings/Service Buildings Electricity]|null; ResearchLab:[Service Buildings/Service Buildings Research]|null; CargoHarbor:[Service Buildings/Service Buildings Transportation]|null; TrainDepot:[Service Buildings/Service Buildings Transportation]|null; TrainStation:[Service Buildings/Service Buildings Transportation]|null; Blank:[Other/Other]|null")]
		[InlineData("subCategory", @"LowHouse:[Buildings Residential]|null; MixedBlock:[Housing]|null; SignatureTower:[Buildings Residential]|null; BusLane:[Networks Roads]|null; BusShelter:[Stops]|null; BusStop:[Networks Stops]|null; TrainTrack:[Networks Tracks]|null; Seaway:[Networks Waterways]|null; Elementary:[Service Buildings Education]|null; University:[Service Buildings Education]|null; GasPlant:[Service Buildings Electricity]|null; ResearchLab:[Service Buildings Research]|null; CargoHarbor:[Service Buildings Transportation]|null; TrainDepot:[Service Buildings Transportation]|null; TrainStation:[Service Buildings Transportation]|null; Blank:[Other]|null")]
		[InlineData("role", @"CargoHarbor:[Cargo Station]|null; TrainDepot:[Depot]|null; ResearchLab:[Research Facility]|null; LowHouse:[Residential]|null; Elementary:[School]|null; TrainStation:[Station]|null; BusStop:[Stop]|null; Blank:[Other]|null; BusLane:[Other]|null; BusShelter:[Other]|null; GasPlant:[Other]|null; MixedBlock:[Other]|null; Seaway:[Other]|null; SignatureTower:[Other]|null; TrainTrack:[Other]|null; University:[Other]|null")]
		[InlineData("schoolTier", @"Elementary:[Elementary (game)]|null; University:[College (game)]|null; Blank:[Other]|null; BusLane:[Bus]|TransportationBus; BusShelter:[Bus]|TransportationBus; BusStop:[Bus]|TransportationBus; CargoHarbor:[Ship]|TransportationShip; GasPlant:[Electricity]|Electricity; LowHouse:[Residential]|ZonesResidential; MixedBlock:[Residential]|ZonesResidential; ResearchLab:[Education Research]|EducationResearch; Seaway:[Ship]|TransportationShip; SignatureTower:[Residential]|ZonesResidential; TrainDepot:[Train]|TransportationTrain; TrainStation:[Train]|TransportationTrain; TrainTrack:[Train]|TransportationTrain")]
		[InlineData("progression", @"Blank:[Other]|null; BusLane:[Founding]|null; BusShelter:[Founding]|null; BusStop:[Founding]|null; CargoHarbor:[Founding]|null; Elementary:[Founding]|null; GasPlant:[Founding]|null; LowHouse:[Founding]|null; MixedBlock:[Founding]|null; Seaway:[Founding]|null; TrainDepot:[Founding]|null; University:[Founding]|null; ResearchLab:[Milestone 1]|null; TrainTrack:[Small Village]|null; TrainStation:[Milestone 3]|null; SignatureTower:[Milestone 5]|null")]
		[InlineData("development", @"Elementary:[Elementary]|null; GasPlant:[Gas Power Plant]|null; University:[University]|null; Blank:[Other]|null; BusLane:[Other]|null; BusShelter:[Other]|null; BusStop:[Other]|null; CargoHarbor:[Other]|null; LowHouse:[Other]|null; MixedBlock:[Other]|null; ResearchLab:[Other]|null; Seaway:[Other]|null; SignatureTower:[Other]|null; TrainDepot:[Other]|null; TrainStation:[Other]|null; TrainTrack:[Other]|null")]
		[InlineData("theme", @"BusShelter:[European]|null; LowHouse:[North American]|null; Blank:[Other]|null; BusLane:[Other]|null; BusStop:[Other]|null; CargoHarbor:[Other]|null; Elementary:[Other]|null; GasPlant:[Other]|null; MixedBlock:[Other]|null; ResearchLab:[Other]|null; Seaway:[Other]|null; SignatureTower:[Other]|null; TrainDepot:[Other]|null; TrainStation:[Other]|null; TrainTrack:[Other]|null; University:[Other]|null")]
		[InlineData("source", @"CargoHarbor:[1]|null; GasPlant:[Custom]|null; TrainTrack:[Vanilla]|null; Blank:[Other]|null; BusLane:[Other]|null; BusShelter:[Other]|null; BusStop:[Other]|null; Elementary:[Other]|null; LowHouse:[Other]|null; MixedBlock:[Other]|null; ResearchLab:[Other]|null; Seaway:[Other]|null; SignatureTower:[Other]|null; TrainDepot:[Other]|null; TrainStation:[Other]|null; University:[Other]|null")]
		[InlineData("density", @"LowHouse:[Low Density]|null; MixedBlock:[Mixed Housing]|null; SignatureTower:[Signature]|null; Blank:[Other]|null; BusLane:[Other]|null; BusShelter:[Other]|null; BusStop:[Other]|null; CargoHarbor:[Other]|null; Elementary:[Other]|null; GasPlant:[Other]|null; ResearchLab:[Other]|null; Seaway:[Other]|null; TrainDepot:[Other]|null; TrainStation:[Other]|null; TrainTrack:[Other]|null; University:[Other]|null")]
		[InlineData("footprint", @"BusLane:[2\u00D72 and under]|null; BusShelter:[2\u00D72 and under]|null; BusStop:[2\u00D72 and under]|null; CargoHarbor:[2\u00D72 and under]|null; Elementary:[2\u00D72 and under]|null; GasPlant:[2\u00D72 and under]|null; LowHouse:[2\u00D72 and under]|null; MixedBlock:[2\u00D72 and under]|null; ResearchLab:[2\u00D72 and under]|null; Seaway:[2\u00D72 and under]|null; TrainTrack:[2\u00D72 and under]|null; University:[2\u00D72 and under]|null; TrainDepot:[6\u00D76 and under]|null; SignatureTower:[Larger than 6\u00D76]|null; TrainStation:[Larger than 6\u00D76]|null; Blank:[Other]|null")]
		[InlineData("cost", @"BusStop:[\u20A10\u2013\u20A15k]|null; LowHouse:[\u20A15k\u2013\u20A125k]|null; TrainDepot:[\u20A125k\u2013\u20A1100k]|null; TrainStation:[\u20A125k\u2013\u20A1100k]|null; GasPlant:[\u20A1100k+]|null; SignatureTower:[\u20A1100k+]|null; Blank:[Other]|null; BusLane:[Other]|null; BusShelter:[Other]|null; CargoHarbor:[Other]|null; Elementary:[Other]|null; MixedBlock:[Other]|null; ResearchLab:[Other]|null; Seaway:[Other]|null; TrainTrack:[Other]|null; University:[Other]|null")]
		[InlineData("none", @"Blank:null|null; BusLane:null|null; BusShelter:null|null; BusStop:null|null; CargoHarbor:null|null; Elementary:null|null; GasPlant:null|null; LowHouse:null|null; MixedBlock:null|null; ResearchLab:null|null; Seaway:null|null; SignatureTower:null|null; TrainDepot:null|null; TrainStation:null|null; TrainTrack:null|null; University:null|null")]
		[InlineData("", @"Blank:null|null; BusLane:null|null; BusShelter:null|null; BusStop:null|null; CargoHarbor:null|null; Elementary:null|null; GasPlant:null|null; LowHouse:null|null; MixedBlock:null|null; ResearchLab:null|null; Seaway:null|null; SignatureTower:null|null; TrainDepot:null|null; TrainStation:null|null; TrainTrack:null|null; University:null|null")]
		[InlineData("   ", @"Blank:null|null; BusLane:null|null; BusShelter:null|null; BusStop:null|null; CargoHarbor:null|null; Elementary:null|null; GasPlant:null|null; LowHouse:null|null; MixedBlock:null|null; ResearchLab:null|null; Seaway:null|null; SignatureTower:null|null; TrainDepot:null|null; TrainStation:null|null; TrainTrack:null|null; University:null|null")]
		[InlineData(null, @"Blank:null|null; BusLane:null|null; BusShelter:null|null; BusStop:null|null; CargoHarbor:null|null; Elementary:null|null; GasPlant:null|null; LowHouse:null|null; MixedBlock:null|null; ResearchLab:null|null; Seaway:null|null; SignatureTower:null|null; TrainDepot:null|null; TrainStation:null|null; TrainTrack:null|null; University:null|null")]
		[InlineData("bogus", @"Blank:[]|null; BusLane:[]|null; BusShelter:[]|null; BusStop:[]|null; CargoHarbor:[]|null; Elementary:[]|null; GasPlant:[]|null; LowHouse:[]|null; MixedBlock:[]|null; ResearchLab:[]|null; Seaway:[]|null; SignatureTower:[]|null; TrainDepot:[]|null; TrainStation:[]|null; TrainTrack:[]|null; University:[]|null")]
		[InlineData("MENUCATEGORY", @"BusLane:[Bus/Networks Roads]|TransportationBus; BusShelter:[Bus/Stops]|TransportationBus; BusStop:[Bus/Networks Stops]|TransportationBus; Elementary:[Education/Elementary]|Education; University:[Education/University]|Education; ResearchLab:[Education Research/Milestone 1]|EducationResearch; GasPlant:[Electricity/Gas Power Plant]|Electricity; LowHouse:[Residential/Low Density]|ZonesResidential; MixedBlock:[Residential/Mixed Housing]|ZonesResidential; SignatureTower:[Residential/Milestone 5]|ZonesResidential; TrainTrack:[Train/Networks Tracks]|TransportationTrain; TrainDepot:[Train/Stations]|TransportationTrain; TrainStation:[Train/Stations]|TransportationTrain; Seaway:[Ship/Networks Waterways]|TransportationShip; CargoHarbor:[Ship/Cargo Stations]|TransportationShip; Blank:[Other/Other]|null")]
		[InlineData(" theme ", @"BusShelter:[European]|null; LowHouse:[North American]|null; Blank:[Other]|null; BusLane:[Other]|null; BusStop:[Other]|null; CargoHarbor:[Other]|null; Elementary:[Other]|null; GasPlant:[Other]|null; MixedBlock:[Other]|null; ResearchLab:[Other]|null; Seaway:[Other]|null; SignatureTower:[Other]|null; TrainDepot:[Other]|null; TrainStation:[Other]|null; TrainTrack:[Other]|null; University:[Other]|null")]
		[InlineData("NONE", @"Blank:null|null; BusLane:null|null; BusShelter:null|null; BusStop:null|null; CargoHarbor:null|null; Elementary:null|null; GasPlant:null|null; LowHouse:null|null; MixedBlock:null|null; ResearchLab:null|null; Seaway:null|null; SignatureTower:null|null; TrainDepot:null|null; TrainStation:null|null; TrainTrack:null|null; University:null|null")]
		public void ThePageCarriesTheHeadingsOfItsDimension(string? dimension, string stamps) =>
			Assert.Equal(stamps, StampsOf(dimension));

		[Fact]
		public void TheOfferedDimensionsAreTheOnesThatSplitTheSet()
		{
			Assert.Equal("menuCategory,category,subCategory,role,progression,development,theme,source,density,footprint,cost,none", string.Join(",", BuildingCatalogGrouping.OfferedDimensions(Set, educationMenu: false)));
			Assert.Equal("menuCategory,category,subCategory,role,schoolTier,progression,development,theme,source,density,footprint,cost,none", string.Join(",", BuildingCatalogGrouping.OfferedDimensions(Set, educationMenu: true)));
			Assert.Equal("none", string.Join(",", BuildingCatalogGrouping.OfferedDimensions(Set.Take(1), educationMenu: true)));
			Assert.Equal("role,progression,theme,density,footprint,cost,none", string.Join(",", BuildingCatalogGrouping.OfferedDimensions(Set.Skip(8).Take(3), educationMenu: false)));
		}
	}
}
