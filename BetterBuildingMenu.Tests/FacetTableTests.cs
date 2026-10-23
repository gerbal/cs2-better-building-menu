using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Every facet's toggle, clear and match, and the facet state the adapter publishes. Toggles
	/// start from nothing selected and from every facet selected, through the ids, aliases, casings and
	/// blanks a caller could send.</summary>
	public sealed class FacetTableTests
	{
		private static readonly string BaseGame = GameDlcIds.BaseGame.ToString(CultureInfo.InvariantCulture);

		internal static readonly BuildingCatalogQuery Empty = new(Offset: 7, SearchText: "kept", StripTabs: new[] { "Tab" }, UiMenu: "Menu");

		internal static readonly BuildingCatalogQuery Seeded = Empty with
		{
			BuildingTypes = new[] { "School", "Hospital" },
			Provenance = new[] { "Vanilla" },
			Availability = new[] { BuildingCatalogFacetSelection.Availability.Locked },
			DlcIds = new[] { "1" },
			Themes = new[] { "European" },
			PlacementFlags = new[] { "RequireRoad" },
			ZoneTypes = new[] { "Low" },
		};

		/// <summary>The facet fields of a query, its offset, and whether it is the instance toggled.</summary>
		internal static string StateOf(BuildingCatalogQuery query, BuildingCatalogQuery? from = null) =>
			"bt=" + List(query.BuildingTypes)
			+ " pv=" + List(query.Provenance)
			+ " av=" + List(query.Availability)
			+ " dlc=" + List(query.DlcIds)
			+ " th=" + List(query.Themes)
			+ " pl=" + List(query.PlacementFlags)
			+ " zt=" + List(query.ZoneTypes)
			+ " tabs=" + List(query.StripTabs)
			+ " off=" + query.Offset
			+ (from is not null && ReferenceEquals(query, from) ? " same" : string.Empty);

		private static string List(IReadOnlyList<string>? values) =>
			values is null ? "null" : "[" + string.Join(",", values) + "]";

		internal static string Toggled(bool seeded, string facet, string option)
		{
			var start = seeded ? Seeded : Empty;

			return StateOf(BuildingCatalogFacetSelection.Toggle(start, facet, option), start);
		}

		private static BuildingCatalogEntry Row(int id, string prefab) => TestEntries.Make(id, prefab, prefab);

		internal static readonly BuildingCatalogEntry[] Set =
		{
			Row(1, "School") with { BuildingType = "School", Provenance = "Vanilla", Theme = "European", PlacementFlags = new[] { "RequireRoad" }, ZoneType = ZoneTypeFilter.Low, DlcId = BaseGame },
			Row(2, "school") with { BuildingType = "school", Provenance = " vanilla ", Theme = "NorthAmerican", PlacementFlags = new[] { "RequireRoad", "Water" }, IsLocked = true, DlcId = "1" },
			Row(3, "Hospital") with { BuildingType = "Hospital", Provenance = "Custom", PlacementFlags = new[] { "Water", " " }, ZoneType = ZoneTypeFilter.High, IsUnique = true, IsAlreadyBuilt = true, DlcId = "2" },
			Row(4, "Park") with { BuildingType = null, Provenance = "Paradox Mods", Theme = "European", ZoneType = ZoneTypeFilter.Mixed, IsLocked = true, IsAlreadyBuilt = true, DlcId = "3", AssetPackIndices = new[] { 7 }, ParkingVehicles = new[] { "Cars" } },
			Row(5, "Plaza") with { BuildingType = "  ", Theme = "", PlacementFlags = new string[0], ZoneType = ZoneTypeFilter.Any, DlcId = "3", ParkingVehicles = new[] { "Bicycles" } },
		};

		internal static readonly Dictionary<string, BuildingCatalogQuery> MatchQueries = new()
		{
			["none"] = new BuildingCatalogQuery(),
			["role school"] = new BuildingCatalogQuery(BuildingTypes: new[] { "school" }),
			["role SCHOOL or Hospital"] = new BuildingCatalogQuery(BuildingTypes: new[] { "SCHOOL", "Hospital" }),
			["role empty list"] = new BuildingCatalogQuery(BuildingTypes: new string[0]),
			["source vanilla"] = new BuildingCatalogQuery(Provenance: new[] { "vanilla" }),
			["availability locked"] = new BuildingCatalogQuery(Availability: new[] { "Locked" }),
			["availability built"] = new BuildingCatalogQuery(Availability: new[] { "alreadybuilt" }),
			["availability unlocked"] = new BuildingCatalogQuery(Availability: new[] { "Unlocked" }),
			["availability locked or built"] = new BuildingCatalogQuery(Availability: new[] { "Locked", "AlreadyBuilt" }),
			["availability bogus"] = new BuildingCatalogQuery(Availability: new[] { "bogus" }),
			["dlc ids"] = new BuildingCatalogQuery(DlcIds: new[] { "1" }),
			["theme european"] = new BuildingCatalogQuery(Themes: new[] { "european" }),
			["placement water"] = new BuildingCatalogQuery(PlacementFlags: new[] { "water" }),
			["placement blank"] = new BuildingCatalogQuery(PlacementFlags: new[] { " " }),
			["zone low"] = new BuildingCatalogQuery(ZoneTypes: new[] { "low" }),
			["zone low or high"] = new BuildingCatalogQuery(ZoneTypes: new[] { "Low", "High" }),
			["zone bogus"] = new BuildingCatalogQuery(ZoneTypes: new[] { "bogus" }),
			["zone by number"] = new BuildingCatalogQuery(ZoneTypes: new[] { "1" }),
			["zone pair in one name"] = new BuildingCatalogQuery(ZoneTypes: new[] { "Low, High" }),
			["role and theme"] = new BuildingCatalogQuery(BuildingTypes: new[] { "school" }, Themes: new[] { "NorthAmerican" }),
		};

		/// <summary>Which rows a query finds, as Count and Query see it.</summary>
		internal static string MatchesOf(BuildingCatalogQuery query) =>
			BuildingCatalogQueryEngine.Count(Set, query) + ":"
			+ string.Join(",", BuildingCatalogQueryEngine.Query(Set, query with { Limit = 100 }).Items.Select(entry => entry.Id));

		internal static string StateOf(BuildingCatalogFacetState state) =>
			string.Join(" ", state.Groups.Select(group =>
				group.Id + "(" + group.Label + (group.Narrowing ? ",narrowing" : string.Empty) + "):"
				+ string.Join(",", group.Options.Select(option => option.Id + "=" + option.Label + (option.Selected ? "*" : string.Empty)))))
			+ (state.HasSelection ? " +selection" : string.Empty);

		internal static string PublishedOf(string fixture)
		{
			return fixture switch
			{
				"nothing selected" => StateOf(BuildingCatalogAdapter.BuildFacetState(Set, new BuildingCatalogQuery())),
				"every facet selected" => StateOf(BuildingCatalogAdapter.BuildFacetState(Set, Seeded)),
				"a selection nothing in view carries" => StateOf(BuildingCatalogAdapter.BuildFacetState(
					Set.Take(2), new BuildingCatalogQuery(BuildingTypes: new[] { "Library" }, Themes: new[] { "asian" }, PlacementFlags: new[] { "Pier" }))),
				"every option selected" => StateOf(BuildingCatalogAdapter.BuildFacetState(
					Set, new BuildingCatalogQuery(Provenance: new[] { "vanilla", "Custom", "Paradox Mods" }))),
				"zone only" => StateOf(BuildingCatalogAdapter.BuildFacetState(Set, new BuildingCatalogQuery(ZoneTypes: new[] { "Low" }))),
				"one row" => StateOf(BuildingCatalogAdapter.BuildFacetState(Set.Take(1), new BuildingCatalogQuery())),
				"pack scope and base game ticked" => StateOf(BuildingCatalogAdapter.BuildFacetState(
					Set.Take(1), new BuildingCatalogQuery(DlcIds: new[] { "3" }), packScope: Set, vanillaSelected: true)),
				_ => StateOf(BuildingCatalogAdapter.BuildFacetState(System.Array.Empty<BuildingCatalogEntry>(), new BuildingCatalogQuery())),
			};
		}

		[Theory]
		[InlineData(false, "buildingType", "School", "bt=[School] pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "buildingType", "School", "bt=[Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "buildingType", " school ", "bt=[school] pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "buildingType", " school ", "bt=[Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "buildingType", "", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "buildingType", "", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "buildingType", "  ", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "buildingType", "  ", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "BUILDINGTYPE", "School", "bt=[School] pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "BUILDINGTYPE", "School", "bt=[Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, " buildingtype ", "Library", "bt=[Library] pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, " buildingtype ", "Library", "bt=[School,Hospital,Library] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "provenance", "Vanilla", "bt=null pv=[Vanilla] av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "provenance", "Vanilla", "bt=[School,Hospital] pv=null av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "provenance", "Custom", "bt=null pv=[Custom] av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "provenance", "Custom", "bt=[School,Hospital] pv=[Vanilla,Custom] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "availability", "Locked", "bt=null pv=null av=[Locked] dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "availability", "Locked", "bt=[School,Hospital] pv=[Vanilla] av=null dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "availability", "unlocked", "bt=null pv=null av=[unlocked] dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "availability", "unlocked", "bt=[School,Hospital] pv=[Vanilla] av=[Locked,unlocked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "availability", "AlreadyBuilt", "bt=null pv=null av=[AlreadyBuilt] dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "availability", "AlreadyBuilt", "bt=[School,Hospital] pv=[Vanilla] av=[Locked,AlreadyBuilt] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "availability", "Bogus", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "availability", "Bogus", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "content", "dlc:5", "bt=null pv=null av=null dlc=[5] th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "content", "dlc:5", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1,5] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "content", "dlc:1", "bt=null pv=null av=null dlc=[1] th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "content", "dlc:1", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=null th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "content", "pack:4211", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "content", "pack:4211", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "content", "vanilla", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "content", "vanilla", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "content", "dlc:", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "content", "dlc:", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "dlc", "dlc:5", "bt=null pv=null av=null dlc=[5] th=null pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "dlc", "dlc:5", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1,5] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "dlc", "vanilla", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "dlc", "vanilla", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "theme", "Asian", "bt=null pv=null av=null dlc=null th=[Asian] pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "theme", "Asian", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European,Asian] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "theme", "european", "bt=null pv=null av=null dlc=null th=[european] pl=null zt=null tabs=[Tab] off=0")]
		[InlineData(true, "theme", "european", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=null pl=[RequireRoad] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "placement", "Water", "bt=null pv=null av=null dlc=null th=null pl=[Water] zt=null tabs=[Tab] off=0")]
		[InlineData(true, "placement", "Water", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad,Water] zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "placement", "requireroad", "bt=null pv=null av=null dlc=null th=null pl=[requireroad] zt=null tabs=[Tab] off=0")]
		[InlineData(true, "placement", "requireroad", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=null zt=[Low] tabs=[Tab] off=0")]
		[InlineData(false, "zone", "High", "bt=null pv=null av=null dlc=null th=null pl=null zt=[High] tabs=[Tab] off=0")]
		[InlineData(true, "zone", "High", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low,High] tabs=[Tab] off=0")]
		[InlineData(false, "zone", "low", "bt=null pv=null av=null dlc=null th=null pl=null zt=[low] tabs=[Tab] off=0")]
		[InlineData(true, "zone", "low", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=null tabs=[Tab] off=0")]
		[InlineData(false, "zonetype", "High", "bt=null pv=null av=null dlc=null th=null pl=null zt=[High] tabs=[Tab] off=0")]
		[InlineData(true, "zonetype", "High", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low,High] tabs=[Tab] off=0")]
		[InlineData(false, "ZoneType", "low", "bt=null pv=null av=null dlc=null th=null pl=null zt=[low] tabs=[Tab] off=0")]
		[InlineData(true, "ZoneType", "low", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=null tabs=[Tab] off=0")]
		[InlineData(false, "assetPack", "pack:4211", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "assetPack", "pack:4211", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "bogus", "School", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "bogus", "School", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, "", "School", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, "", "School", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		[InlineData(false, " ", "School", "bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=7 same")]
		[InlineData(true, " ", "School", "bt=[School,Hospital] pv=[Vanilla] av=[Locked] dlc=[1] th=[European] pl=[RequireRoad] zt=[Low] tabs=[Tab] off=7 same")]
		public void EachFacetTogglesItsOwnSelection(bool seeded, string facet, string option, string expected) =>
			Assert.Equal(expected, Toggled(seeded, facet, option));

		[Fact]
		public void AvailabilityNarrowsFromAllAndCollapsesBackOnceEveryStateIsPicked()
		{
			var query = Empty;
			var steps = new List<string>();

			foreach (var option in BuildingCatalogFacetSelection.Availability.All.Reverse())
			{
				query = BuildingCatalogFacetSelection.Toggle(query, FacetIds.Availability, option);
				steps.Add(StateOf(query));
			}

			Assert.Equal(
				new[]
				{
					"bt=null pv=null av=[AlreadyBuilt] dlc=null th=null pl=null zt=null tabs=[Tab] off=0",
					"bt=null pv=null av=[AlreadyBuilt,Locked] dlc=null th=null pl=null zt=null tabs=[Tab] off=0",
					"bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0",
				},
				steps);
		}

		[Fact]
		public void ClearDropsEveryFacetAndKeepsEverythingElse()
		{
			var expected = Seeded with
			{
				BuildingTypes = null,
				Provenance = null,
				Availability = null,
				DlcIds = null,
				Themes = null,
				PlacementFlags = null,
				ZoneTypes = null,
				Offset = 0,
			};

			Assert.Equal(expected, BuildingCatalogFacetSelection.Clear(Seeded));
			Assert.Equal(expected, BuildingCatalogFacetSelection.Clear(Empty));
			Assert.Equal(
				"bt=null pv=null av=null dlc=null th=null pl=null zt=null tabs=[Tab] off=0",
				StateOf(BuildingCatalogFacetSelection.Clear(Seeded)));
		}

		[Theory]
		[InlineData("none", "5:3,4,5,1,2")]
		[InlineData("role school", "2:1,2")]
		[InlineData("role SCHOOL or Hospital", "3:3,1,2")]
		[InlineData("role empty list", "5:3,4,5,1,2")]
		[InlineData("source vanilla", "1:1")]
		[InlineData("availability locked", "2:4,2")]
		[InlineData("availability built", "1:3")]
		[InlineData("availability unlocked", "2:5,1")]
		[InlineData("availability locked or built", "3:3,4,2")]
		[InlineData("availability bogus", "0:")]
		[InlineData("dlc ids", "5:3,4,5,1,2")]
		[InlineData("theme european", "2:4,1")]
		[InlineData("placement water", "2:3,2")]
		[InlineData("placement blank", "1:3")]
		[InlineData("zone low", "1:1")]
		[InlineData("zone low or high", "2:3,1")]
		[InlineData("zone bogus", "0:")]
		[InlineData("zone by number", "1:1")]
		[InlineData("zone pair in one name", "0:")]
		[InlineData("role and theme", "1:2")]
		public void EachFacetNarrowsToTheRowsItsSelectionNames(string query, string expected) =>
			Assert.Equal(expected, MatchesOf(MatchQueries[query]));

		[Theory]
		[InlineData("nothing selected", "buildingType(Role):Hospital=Hospital,School=School provenance(Source):Custom=Custom content,Paradox Mods=Paradox Mods,Vanilla=Base game availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built content(Content):vanilla=No DLC required,dlc:1=Unresolved DLC content (ID 1),dlc:2=Unresolved DLC content (ID 2) theme(Theme):European=European,NorthAmerican=North American placement(Placement):RequireRoad=Require road,Water=Water vehicle(Vehicle):Bicycles=Bicycles,Cars=Cars")]
		[InlineData("every facet selected", "buildingType(Role):Hospital=Hospital*,School=School* provenance(Source,narrowing):Custom=Custom content,Paradox Mods=Paradox Mods,Vanilla=Base game* availability(Availability,narrowing):Unlocked=Unlocked,Locked=Locked*,AlreadyBuilt=Already Built content(Content):vanilla=No DLC required,dlc:1=Unresolved DLC content (ID 1)*,dlc:2=Unresolved DLC content (ID 2) theme(Theme,narrowing):European=European*,NorthAmerican=North American placement(Placement,narrowing):RequireRoad=Require road*,Water=Water vehicle(Vehicle):Bicycles=Bicycles,Cars=Cars +selection")]
		[InlineData("a selection nothing in view carries", "buildingType(Role,narrowing):Library=Library*,School=School availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built content(Content):vanilla=No DLC required,dlc:1=Unresolved DLC content (ID 1) theme(Theme,narrowing):asian=asian*,European=European,NorthAmerican=North American placement(Placement,narrowing):Pier=Pier*,RequireRoad=Require road,Water=Water +selection")]
		[InlineData("every option selected", "buildingType(Role):Hospital=Hospital,School=School provenance(Source):Custom=Custom content*,Paradox Mods=Paradox Mods*,Vanilla=Base game* availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built content(Content):vanilla=No DLC required,dlc:1=Unresolved DLC content (ID 1),dlc:2=Unresolved DLC content (ID 2) theme(Theme):European=European,NorthAmerican=North American placement(Placement):RequireRoad=Require road,Water=Water vehicle(Vehicle):Bicycles=Bicycles,Cars=Cars +selection")]
		[InlineData("zone only", "buildingType(Role):Hospital=Hospital,School=School provenance(Source):Custom=Custom content,Paradox Mods=Paradox Mods,Vanilla=Base game availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built content(Content):vanilla=No DLC required,dlc:1=Unresolved DLC content (ID 1),dlc:2=Unresolved DLC content (ID 2) theme(Theme):European=European,NorthAmerican=North American placement(Placement):RequireRoad=Require road,Water=Water vehicle(Vehicle):Bicycles=Bicycles,Cars=Cars")]
		[InlineData("one row", "availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built")]
		[InlineData("pack scope and base game ticked", "availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built content(Content):vanilla=No DLC required*,dlc:1=Unresolved DLC content (ID 1),dlc:2=Unresolved DLC content (ID 2) +selection")]
		[InlineData("empty", "availability(Availability):Unlocked=Unlocked,Locked=Locked,AlreadyBuilt=Already Built")]
		public void TheAdapterPublishesEachFacetsGroup(string fixture, string expected) =>
			Assert.Equal(expected, PublishedOf(fixture));
	}
}
