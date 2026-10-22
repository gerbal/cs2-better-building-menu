using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Colossal.UI.Binding;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Tests;

/// <summary>
/// The exact token stream every <see cref="IJsonWritable"/> in the domain writes: property
/// order, value types (Int32 against Double), null against an empty string, and array sizes
/// are all part of what the UI reads.
/// </summary>
public sealed class JsonWriteGoldenTests
{
    private static List<string> Record(IJsonWritable value)
    {
        RecordingJsonWriter writer = new();
        value.Write(writer);
        return writer.Tokens;
    }

    // What a null string writes as: the recorder marks it apart from an empty string.
    private const string NullString = "Write:String:<null>";

    // The tokens one property of a flat object wrote, from after its name to the next property.
    private static string[] Written(List<string> tokens, string property)
    {
        int start = tokens.IndexOf("PropertyName:" + property);
        Assert.True(start >= 0, "no property named " + property);

        return tokens
            .Skip(start + 1)
            .TakeWhile(token => !token.StartsWith("PropertyName:", StringComparison.Ordinal) && token != "TypeEnd")
            .ToArray();
    }

    private static string Begin(Type type) => "TypeBegin:" + type.FullName;

    private static string[] Join(params IEnumerable<string>[] parts) => parts.SelectMany(part => part).ToArray();

    // ---- BuildingCatalogEntry ----

    [Fact]
    public void Entry_WithDefaults_WritesFallbacksNullsAndEmptyArrays()
    {
        BuildingCatalogEntry entry = TestEntries.Make();

        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogEntry)),
                "PropertyName:id", "Write:Int32:1",
                "PropertyName:prefabName", "Write:String:Building",
                "PropertyName:name", "Write:String:Building",
                "PropertyName:category", "Write:String:ServiceBuildings",
                "PropertyName:subCategory", "Write:String:Any",
                "PropertyName:categoryLabel", "Write:String:ServiceBuildings",
                "PropertyName:subCategoryLabel", "Write:String:Any",
                "PropertyName:thumbnail", "Write:String:",
                "PropertyName:fallbackThumbnail", "Write:String:",
                "PropertyName:silhouetteThumbnail", "Write:String:",
                "PropertyName:lotWidth", "Write:Int32:1",
                "PropertyName:lotDepth", "Write:Int32:1",
                "PropertyName:buildingLevel", "Write:Int32:1",
                "PropertyName:zoneType", "Write:Int32:0",
                "PropertyName:hasParking", "Write:Boolean:False",
                "PropertyName:isVanilla", "Write:Boolean:True",
                "PropertyName:isLocked", "Write:Boolean:False",
                "PropertyName:isUnique", "Write:Boolean:False",
                "PropertyName:isAlreadyBuilt", "Write:Boolean:False",
                "PropertyName:unlockMilestone", "Write:Int32:0",
                "PropertyName:devTreeBranch", "Write:String:",
                "PropertyName:devTreeBranchDepth", "Write:Int32:0",
                "PropertyName:unlockRequirements", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:bonuses", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:costIsPerDistance", "Write:Boolean:False",
                "PropertyName:parkingSlots", "Write:Int32:0",
                "PropertyName:pdxModsId", "Write:String:",
                "PropertyName:educationLevel", "WriteNull",
                "PropertyName:buildingType", "Write:String:",
                "PropertyName:provenance", "Write:String:",
                "PropertyName:dlcId", "Write:String:",
                "PropertyName:theme", "Write:String:",
                "PropertyName:assetPacks", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:placementFlags", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:extensions", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:supportedUpgrades", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:constructionCost", "WriteNull",
                "PropertyName:upkeep", "WriteNull",
                "PropertyName:workers", "WriteNull",
                "PropertyName:households", "WriteNull",
                "PropertyName:capacity", "WriteNull",
                "PropertyName:serviceRange", "WriteNull",
                "PropertyName:serviceFacts", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:footprints", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:footprintOverflow", "Write:Int32:0",
                "PropertyName:serviceTextFacts", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:speedLimit", "WriteNull",
                "PropertyName:networkWidth", "WriteNull",
                "PropertyName:leisureType", "Write:String:",
                "PropertyName:leisureEfficiency", "WriteNull",
                "PropertyName:electricityConsumption", "WriteNull",
                "PropertyName:waterConsumption", "WriteNull",
                "PropertyName:garbageAccumulation", "WriteNull",
                "PropertyName:telecomNeed", "WriteNull",
                "PropertyName:waterCapacity", "WriteNull",
                "PropertyName:sewageCapacity", "WriteNull",
                "PropertyName:groundPollution", "WriteNull",
                "PropertyName:airPollution", "WriteNull",
                "PropertyName:noisePollution", "WriteNull",
                "PropertyName:groupPath", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:groupLabelId", "Write:String:",
                "TypeEnd",
            },
            Record(entry));
    }

    [Fact]
    public void Entry_WithEveryFieldSet_WritesEachValueInItsOwnType()
    {
        BuildingCatalogEntry entry = TestEntries.Make(
            id: 42,
            name: "Coal Plant",
            prefabName: "PowerPlant01",
            category: "Buildings",
            subCategory: "Buildings_Industrial",
            lotWidth: 4,
            lotDepth: 3,
            buildingLevel: 3,
            zoneType: ZoneTypeFilter.High,
            hasParking: true,
            thumbnail: "thumb://a",
            pdxModsId: "12345") with
        {
            CategoryLabel = "Buildings label",
            SubCategoryLabel = "Industrial label",
            FallbackThumbnail = "thumb://b",
            SilhouetteThumbnail = "thumb://c",
            IsVanilla = false,
            IsLocked = true,
            IsUnique = true,
            IsAlreadyBuilt = true,
            UnlockMilestone = 5,
            DevTreeBranch = "Electricity",
            DevTreeBranchDepth = 2,
            UnlockRequirements = new[] { "Req A", " ", string.Empty, "Req B" },
            Bonuses = new[] { "Bonus", null!, "\t" },
            CostIsPerDistance = true,
            ParkingSlots = 12,
            EducationLevel = 2,
            BuildingType = "PowerPlant",
            Provenance = "Mod",
            DlcId = "dlc1",
            Theme = "European",
            AssetPacks = new[] { "PackA", "PackB" },
            PlacementFlags = new[] { "Flag" },
            Extensions = new[] { "Ext1" },
            SupportedUpgrades = new[] { "Up1", "Up2" },
            ConstructionCost = 80000,
            Upkeep = 5000.5,
            Workers = 40,
            Households = 12,
            Capacity = 200,
            ServiceRange = 1500,
            ServiceFacts = new[] { new ServiceFact("capacity", 5), new ServiceFact("range", 3) },
            Footprints = new[] { new ZoneFootprint(2, 3) },
            FootprintOverflow = 4,
            ServiceTextFacts = new[] { new ServiceTextFact("sold", "Grain") },
            SpeedLimit = 50,
            NetworkWidth = 8.5,
            LeisureType = "Beach",
            LeisureEfficiency = 0.75,
            ElectricityConsumption = 100,
            WaterConsumption = 20,
            GarbageAccumulation = 3,
            TelecomNeed = 4,
            WaterCapacity = 500,
            SewageCapacity = 450,
            GroundPollution = 1.5,
            AirPollution = 2,
            NoisePollution = 7.25,
            GroupPath = new[] { "Group A", "Group B" },
            GroupLabelId = "Cat_Group",
        };

        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogEntry)),
                "PropertyName:id", "Write:Int32:42",
                "PropertyName:prefabName", "Write:String:PowerPlant01",
                "PropertyName:name", "Write:String:Coal Plant",
                "PropertyName:category", "Write:String:Buildings",
                "PropertyName:subCategory", "Write:String:Buildings_Industrial",
                "PropertyName:categoryLabel", "Write:String:Buildings label",
                "PropertyName:subCategoryLabel", "Write:String:Industrial label",
                "PropertyName:thumbnail", "Write:String:thumb://a",
                "PropertyName:fallbackThumbnail", "Write:String:thumb://b",
                "PropertyName:silhouetteThumbnail", "Write:String:thumb://c",
                "PropertyName:lotWidth", "Write:Int32:4",
                "PropertyName:lotDepth", "Write:Int32:3",
                "PropertyName:buildingLevel", "Write:Int32:3",
                "PropertyName:zoneType", "Write:Int32:8",
                "PropertyName:hasParking", "Write:Boolean:True",
                "PropertyName:isVanilla", "Write:Boolean:False",
                "PropertyName:isLocked", "Write:Boolean:True",
                "PropertyName:isUnique", "Write:Boolean:True",
                "PropertyName:isAlreadyBuilt", "Write:Boolean:True",
                "PropertyName:unlockMilestone", "Write:Int32:5",
                "PropertyName:devTreeBranch", "Write:String:Electricity",
                "PropertyName:devTreeBranchDepth", "Write:Int32:2",
                "PropertyName:unlockRequirements", "ArrayBegin:2", "Write:String:Req A", "Write:String:Req B", "ArrayEnd",
                "PropertyName:bonuses", "ArrayBegin:1", "Write:String:Bonus", "ArrayEnd",
                "PropertyName:costIsPerDistance", "Write:Boolean:True",
                "PropertyName:parkingSlots", "Write:Int32:12",
                "PropertyName:pdxModsId", "Write:String:12345",
                "PropertyName:educationLevel", "Write:Int32:2",
                "PropertyName:buildingType", "Write:String:PowerPlant",
                "PropertyName:provenance", "Write:String:Mod",
                "PropertyName:dlcId", "Write:String:dlc1",
                "PropertyName:theme", "Write:String:European",
                "PropertyName:assetPacks", "ArrayBegin:2", "Write:String:PackA", "Write:String:PackB", "ArrayEnd",
                "PropertyName:placementFlags", "ArrayBegin:1", "Write:String:Flag", "ArrayEnd",
                "PropertyName:extensions", "ArrayBegin:1", "Write:String:Ext1", "ArrayEnd",
                "PropertyName:supportedUpgrades", "ArrayBegin:2", "Write:String:Up1", "Write:String:Up2", "ArrayEnd",
                "PropertyName:constructionCost", "Write:Double:80000",
                "PropertyName:upkeep", "Write:Double:5000.5",
                "PropertyName:workers", "Write:Double:40",
                "PropertyName:households", "Write:Double:12",
                "PropertyName:capacity", "Write:Double:200",
                "PropertyName:serviceRange", "Write:Double:1500",
                "PropertyName:serviceFacts",
                "ArrayBegin:2",
                Begin(typeof(ServiceFact)), "PropertyName:key", "Write:String:capacity", "PropertyName:value", "Write:Double:5", "TypeEnd",
                Begin(typeof(ServiceFact)), "PropertyName:key", "Write:String:range", "PropertyName:value", "Write:Double:3", "TypeEnd",
                "ArrayEnd",
                "PropertyName:footprints",
                "ArrayBegin:1",
                Begin(typeof(ZoneFootprint)), "PropertyName:width", "Write:Int32:2", "PropertyName:depth", "Write:Int32:3", "TypeEnd",
                "ArrayEnd",
                "PropertyName:footprintOverflow", "Write:Int32:4",
                "PropertyName:serviceTextFacts",
                "ArrayBegin:1",
                Begin(typeof(ServiceTextFact)), "PropertyName:key", "Write:String:sold", "PropertyName:value", "Write:String:Grain", "TypeEnd",
                "ArrayEnd",
                "PropertyName:speedLimit", "Write:Double:50",
                "PropertyName:networkWidth", "Write:Double:8.5",
                "PropertyName:leisureType", "Write:String:Beach",
                "PropertyName:leisureEfficiency", "Write:Double:0.75",
                "PropertyName:electricityConsumption", "Write:Double:100",
                "PropertyName:waterConsumption", "Write:Double:20",
                "PropertyName:garbageAccumulation", "Write:Double:3",
                "PropertyName:telecomNeed", "Write:Double:4",
                "PropertyName:waterCapacity", "Write:Double:500",
                "PropertyName:sewageCapacity", "Write:Double:450",
                "PropertyName:groundPollution", "Write:Double:1.5",
                "PropertyName:airPollution", "Write:Double:2",
                "PropertyName:noisePollution", "Write:Double:7.25",
                "PropertyName:groupPath", "ArrayBegin:2", "Write:String:Group A", "Write:String:Group B", "ArrayEnd",
                "PropertyName:groupLabelId", "Write:String:Cat_Group",
                "TypeEnd",
            },
            Record(entry));
    }

    [Fact]
    public void Entry_WithNullStrings_WritesNullWhereThePropertyPassesThemThrough()
    {
        BuildingCatalogEntry entry = TestEntries.Make() with
        {
            PrefabName = null!,
            Name = null!,
            Category = null!,
            SubCategory = null!,
            Thumbnail = null!,
            PdxModsId = null!,
        };

        List<string> tokens = Record(entry);

        // The two labels fall back to the category, which is itself null here.
        foreach (string property in new[] { "prefabName", "name", "category", "subCategory", "categoryLabel", "subCategoryLabel", "thumbnail", "pdxModsId" })
        {
            Assert.Equal(new[] { NullString }, Written(tokens, property));
        }

        foreach (string property in new[] { "fallbackThumbnail", "silhouetteThumbnail", "devTreeBranch", "buildingType", "provenance", "dlcId", "theme", "leisureType", "groupLabelId" })
        {
            Assert.Equal(new[] { "Write:String:" }, Written(tokens, property));
        }
    }

    [Fact]
    public void Entry_WithBlankAndNullListMembers_FiltersSixListsAndKeepsGroupPathAsGiven()
    {
        string[] members = { "keep", null!, " ", string.Empty, "\t", "also" };
        BuildingCatalogEntry entry = TestEntries.Make() with
        {
            UnlockRequirements = members,
            Bonuses = members,
            AssetPacks = members,
            PlacementFlags = members,
            Extensions = members,
            SupportedUpgrades = members,
            GroupPath = members,
        };

        List<string> tokens = Record(entry);

        foreach (string property in new[] { "unlockRequirements", "bonuses", "assetPacks", "placementFlags", "extensions", "supportedUpgrades" })
        {
            Assert.Equal(new[] { "ArrayBegin:2", "Write:String:keep", "Write:String:also", "ArrayEnd" }, Written(tokens, property));
        }

        Assert.Equal(
            new[]
            {
                "ArrayBegin:6", "Write:String:keep", NullString, "Write:String: ", "Write:String:", "Write:String:\t", "Write:String:also", "ArrayEnd",
            },
            Written(tokens, "groupPath"));
    }

    // ---- BuildingCatalogPage ----

    [Fact]
    public void Page_WithDefaults_WritesEmptyListsAndNoStatus()
    {
        BuildingCatalogPage page = new(Array.Empty<BuildingCatalogEntry>(), TotalCount: 0, Offset: 0, Limit: 40);

        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogPage)),
                "PropertyName:items", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:reorderableSortColumns", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:totalCount", "Write:Int32:0",
                "PropertyName:offset", "Write:Int32:0",
                "PropertyName:limit", "Write:Int32:40",
                "PropertyName:hasMore", "Write:Boolean:False",
                "PropertyName:bestMatch", "WriteNull",
                "PropertyName:searchText", "Write:String:",
                "PropertyName:menu", "Write:String:",
                "TypeEnd",
            },
            Record(page));
    }

    [Fact]
    public void Page_WithEveryFieldSet_WritesItemsFirstAndStatusLast()
    {
        BuildingCatalogEntry first = TestEntries.Make(id: 1, name: "First");
        BuildingCatalogEntry second = TestEntries.Make(id: 2, name: "Second");
        BuildingCatalogPage page = new(
            new[] { first, second },
            TotalCount: 57,
            Offset: 40,
            Limit: 20,
            Status: "Searching",
            HasMore: true,
            ReorderableSortColumns: new[] { "cost", "name" },
            BestMatch: second,
            SearchText: "coal",
            Menu: "Roads");

        Assert.Equal(
            Join(
                new[] { Begin(typeof(BuildingCatalogPage)), "PropertyName:items", "ArrayBegin:2" },
                Record(first),
                Record(second),
                new[]
                {
                    "ArrayEnd",
                    "PropertyName:reorderableSortColumns", "ArrayBegin:2", "Write:String:cost", "Write:String:name", "ArrayEnd",
                    "PropertyName:totalCount", "Write:Int32:57",
                    "PropertyName:offset", "Write:Int32:40",
                    "PropertyName:limit", "Write:Int32:20",
                    "PropertyName:hasMore", "Write:Boolean:True",
                    "PropertyName:bestMatch",
                },
                Record(second),
                new[]
                {
                    "PropertyName:searchText", "Write:String:coal",
                    "PropertyName:menu", "Write:String:Roads",
                    "PropertyName:status", "Write:String:Searching",
                    "TypeEnd",
                }),
            Record(page));
    }

    [Fact]
    public void Page_WithBlankAndNullSortColumns_WritesEveryMemberAsGiven()
    {
        BuildingCatalogPage page = new(
            Array.Empty<BuildingCatalogEntry>(),
            TotalCount: 0,
            Offset: 0,
            Limit: 40,
            ReorderableSortColumns: new[] { "cost", null!, " ", string.Empty });

        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogPage)),
                "PropertyName:items", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:reorderableSortColumns", "ArrayBegin:4", "Write:String:cost", NullString, "Write:String: ", "Write:String:", "ArrayEnd",
                "PropertyName:totalCount", "Write:Int32:0",
                "PropertyName:offset", "Write:Int32:0",
                "PropertyName:limit", "Write:Int32:40",
                "PropertyName:hasMore", "Write:Boolean:False",
                "PropertyName:bestMatch", "WriteNull",
                "PropertyName:searchText", "Write:String:",
                "PropertyName:menu", "Write:String:",
                "TypeEnd",
            },
            Record(page));
    }

    // ---- BuildingExtensionMenu ----

    [Fact]
    public void ExtensionMenu_Empty_WritesAnEmptyName()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingExtensionMenu)),
                "PropertyName:buildingName", "Write:String:",
                "PropertyName:entries", "ArrayBegin:0", "ArrayEnd",
                "TypeEnd",
            },
            Record(BuildingExtensionMenu.Empty));
    }

    [Fact]
    public void ExtensionMenu_WritesTheBuildingThenEachEntryInOrder()
    {
        BuildingCatalogEntry first = TestEntries.Make(id: 1, name: "First");
        BuildingCatalogEntry second = TestEntries.Make(id: 2, name: "Second");
        BuildingExtensionMenu menu = new("Hospital", new[] { first, second });

        Assert.Equal(
            Join(
                new[] { Begin(typeof(BuildingExtensionMenu)), "PropertyName:buildingName", "Write:String:Hospital", "PropertyName:entries", "ArrayBegin:2" },
                Record(first),
                Record(second),
                new[] { "ArrayEnd", "TypeEnd" }),
            Record(menu));
    }

    [Fact]
    public void ExtensionMenu_WithANullName_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingExtensionMenu)),
                "PropertyName:buildingName", NullString,
                "PropertyName:entries", "ArrayBegin:0", "ArrayEnd",
                "TypeEnd",
            },
            Record(new BuildingExtensionMenu(null!, Array.Empty<BuildingCatalogEntry>())));
    }

    // ---- BuildingCatalogMetricRangeState ----

    [Fact]
    public void MetricRangeState_Empty_WritesNullForEveryBound()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogMetricRangeState)),
                "PropertyName:minCost", "WriteNull",
                "PropertyName:maxCost", "WriteNull",
                "PropertyName:minUpkeep", "WriteNull",
                "PropertyName:maxUpkeep", "WriteNull",
                "PropertyName:minWorkers", "WriteNull",
                "PropertyName:maxWorkers", "WriteNull",
                "PropertyName:minCapacity", "WriteNull",
                "PropertyName:maxCapacity", "WriteNull",
                "PropertyName:minLotWidth", "WriteNull",
                "PropertyName:maxLotWidth", "WriteNull",
                "PropertyName:minLotDepth", "WriteNull",
                "PropertyName:maxLotDepth", "WriteNull",
                "PropertyName:hasSelection", "Write:Boolean:False",
                "TypeEnd",
            },
            Record(BuildingCatalogMetricRangeState.Empty));
    }

    [Fact]
    public void MetricRangeState_WithEveryBoundSet_WritesDoublesAndASelection()
    {
        BuildingCatalogMetricRangeState state = new(1000, 90000.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogMetricRangeState)),
                "PropertyName:minCost", "Write:Double:1000",
                "PropertyName:maxCost", "Write:Double:90000.5",
                "PropertyName:minUpkeep", "Write:Double:1",
                "PropertyName:maxUpkeep", "Write:Double:2",
                "PropertyName:minWorkers", "Write:Double:3",
                "PropertyName:maxWorkers", "Write:Double:4",
                "PropertyName:minCapacity", "Write:Double:5",
                "PropertyName:maxCapacity", "Write:Double:6",
                "PropertyName:minLotWidth", "Write:Double:7",
                "PropertyName:maxLotWidth", "Write:Double:8",
                "PropertyName:minLotDepth", "Write:Double:9",
                "PropertyName:maxLotDepth", "Write:Double:10",
                "PropertyName:hasSelection", "Write:Boolean:True",
                "TypeEnd",
            },
            Record(state));
    }

    [Fact]
    public void MetricRangeState_WithOneBoundSet_NullsTheRestAndStillSelects()
    {
        BuildingCatalogMetricRangeState state = BuildingCatalogMetricRangeState.Empty with { MaxWorkers = 25 };

        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogMetricRangeState)),
                "PropertyName:minCost", "WriteNull",
                "PropertyName:maxCost", "WriteNull",
                "PropertyName:minUpkeep", "WriteNull",
                "PropertyName:maxUpkeep", "WriteNull",
                "PropertyName:minWorkers", "WriteNull",
                "PropertyName:maxWorkers", "Write:Double:25",
                "PropertyName:minCapacity", "WriteNull",
                "PropertyName:maxCapacity", "WriteNull",
                "PropertyName:minLotWidth", "WriteNull",
                "PropertyName:maxLotWidth", "WriteNull",
                "PropertyName:minLotDepth", "WriteNull",
                "PropertyName:maxLotDepth", "WriteNull",
                "PropertyName:hasSelection", "Write:Boolean:True",
                "TypeEnd",
            },
            Record(state));
    }

    // ---- Menu strips ----

    [Fact]
    public void MenuBranchCount_WritesTheMatchKeyWhenThereIsNoLabel()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(MenuBranchCount)),
                "PropertyName:id", "Write:String:Education",
                "PropertyName:count", "Write:Int32:12",
                "PropertyName:icon", "Write:String:Media/Game/Icons/Education.svg",
                "PropertyName:label", "Write:String:Education",
                "TypeEnd",
            },
            Record(new MenuBranchCount("Education", 12, "Media/Game/Icons/Education.svg")));
    }

    [Fact]
    public void MenuBranchCount_WritesTheLabelAndAnEmptyIconForNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(MenuBranchCount)),
                "PropertyName:id", "Write:String:Low|Residential",
                "PropertyName:count", "Write:Int32:3",
                "PropertyName:icon", "Write:String:",
                "PropertyName:label", "Write:String:Low",
                "TypeEnd",
            },
            Record(new MenuBranchCount("Low|Residential", 3, null!, "Low")));
    }

    [Fact]
    public void MenuBranchCount_WithANullIdAndNoLabel_WritesNullIdAndLabel()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(MenuBranchCount)),
                "PropertyName:id", NullString,
                "PropertyName:count", "Write:Int32:3",
                "PropertyName:icon", "Write:String:",
                "PropertyName:label", NullString,
                "TypeEnd",
            },
            Record(new MenuBranchCount(null!, 3, null!)));
    }

    [Fact]
    public void MenuCategoryCount_WritesTheIdAndCount()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(MenuCategoryCount)),
                "PropertyName:id", "Write:String:Parks",
                "PropertyName:count", "Write:Int32:8",
                "TypeEnd",
            },
            Record(new MenuCategoryCount("Parks", 8)));
    }

    [Fact]
    public void MenuCategoryCount_WithANullId_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(MenuCategoryCount)),
                "PropertyName:id", NullString,
                "PropertyName:count", "Write:Int32:8",
                "TypeEnd",
            },
            Record(new MenuCategoryCount(null!, 8)));
    }

    [Fact]
    public void MenuCategoryTabs_WritesEachTabInOrder()
    {
        MenuBranchCount first = new("Low", 2, "low.svg");
        MenuBranchCount second = new("High", 5, "high.svg", "Tall");
        MenuCategoryTabs tabs = new("Zones", new[] { first, second });

        Assert.Equal(
            Join(
                new[] { Begin(typeof(MenuCategoryTabs)), "PropertyName:categoryId", "Write:String:Zones", "PropertyName:tabs", "ArrayBegin:2" },
                Record(first),
                Record(second),
                new[] { "ArrayEnd", "TypeEnd" }),
            Record(tabs));
    }

    [Fact]
    public void MenuCategoryTabs_WithNullMembers_WritesAnEmptyIdAndNoTabs()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(MenuCategoryTabs)),
                "PropertyName:categoryId", "Write:String:",
                "PropertyName:tabs", "ArrayBegin:0", "ArrayEnd",
                "TypeEnd",
            },
            Record(new MenuCategoryTabs(null!, null!)));
    }

    [Fact]
    public void VanillaMenuCategory_WritesItsFourFields()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(VanillaMenuCategory)),
                "PropertyName:id", "Write:String:RoadsHighways",
                "PropertyName:name", "Write:String:Highways",
                "PropertyName:icon", "Write:String:highway.svg",
                "PropertyName:priority", "Write:Int32:30",
                "TypeEnd",
            },
            Record(new VanillaMenuCategory("RoadsHighways", "Highways", "highway.svg", 30)));
    }

    [Fact]
    public void VanillaMenuCategory_WithNullStrings_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(VanillaMenuCategory)),
                "PropertyName:id", NullString,
                "PropertyName:name", NullString,
                "PropertyName:icon", NullString,
                "PropertyName:priority", "Write:Int32:30",
                "TypeEnd",
            },
            Record(new VanillaMenuCategory(null!, null!, null!, 30)));
    }

    [Fact]
    public void OwnedAssetMenu_WritesTheIndexAndName()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(OwnedAssetMenu)),
                "PropertyName:index", "Write:Int32:17",
                "PropertyName:name", "Write:String:Roads",
                "TypeEnd",
            },
            Record(new OwnedAssetMenu(17, "Roads")));
    }

    [Fact]
    public void OwnedAssetMenu_WithANullName_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(OwnedAssetMenu)),
                "PropertyName:index", "Write:Int32:17",
                "PropertyName:name", NullString,
                "TypeEnd",
            },
            Record(new OwnedAssetMenu(17, null!)));
    }

    // ---- Facets ----

    [Fact]
    public void FacetOption_WritesIdLabelAndSelection()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogFacetOption)),
                "PropertyName:id", "Write:String:Vanilla",
                "PropertyName:label", "Write:String:Vanilla assets",
                "PropertyName:selected", "Write:Boolean:True",
                "TypeEnd",
            },
            Record(new BuildingCatalogFacetOption("Vanilla", "Vanilla assets", true)));
    }

    [Fact]
    public void FacetOption_WithNullStrings_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogFacetOption)),
                "PropertyName:id", NullString,
                "PropertyName:label", NullString,
                "PropertyName:selected", "Write:Boolean:False",
                "TypeEnd",
            },
            Record(new BuildingCatalogFacetOption(null!, null!, false)));
    }

    [Fact]
    public void FacetGroup_WritesNarrowingBeforeItsOptions()
    {
        BuildingCatalogFacetOption first = new("A", "Alpha", true);
        BuildingCatalogFacetOption second = new("B", "Beta", false);
        BuildingCatalogFacetGroup group = new("Content", "Content", new[] { first, second }, Narrowing: true);

        Assert.Equal(
            Join(
                new[]
                {
                    Begin(typeof(BuildingCatalogFacetGroup)),
                    "PropertyName:id", "Write:String:Content",
                    "PropertyName:label", "Write:String:Content",
                    "PropertyName:narrowing", "Write:Boolean:True",
                    "PropertyName:options", "ArrayBegin:2",
                },
                Record(first),
                Record(second),
                new[] { "ArrayEnd", "TypeEnd" }),
            Record(group));
    }

    [Fact]
    public void FacetGroup_WithoutOptions_WritesAnEmptyArrayAndNoNarrowing()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogFacetGroup)),
                "PropertyName:id", "Write:String:Theme",
                "PropertyName:label", "Write:String:Theme",
                "PropertyName:narrowing", "Write:Boolean:False",
                "PropertyName:options", "ArrayBegin:0", "ArrayEnd",
                "TypeEnd",
            },
            Record(new BuildingCatalogFacetGroup("Theme", "Theme", Array.Empty<BuildingCatalogFacetOption>())));
    }

    [Fact]
    public void FacetGroup_WithNullStrings_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogFacetGroup)),
                "PropertyName:id", NullString,
                "PropertyName:label", NullString,
                "PropertyName:narrowing", "Write:Boolean:False",
                "PropertyName:options", "ArrayBegin:0", "ArrayEnd",
                "TypeEnd",
            },
            Record(new BuildingCatalogFacetGroup(null!, null!, Array.Empty<BuildingCatalogFacetOption>())));
    }

    [Fact]
    public void FacetState_WritesEachGroupThenTheSelectionFlag()
    {
        BuildingCatalogFacetGroup first = new("Content", "Content", new[] { new BuildingCatalogFacetOption("A", "Alpha", true) });
        BuildingCatalogFacetGroup second = new("Theme", "Theme", Array.Empty<BuildingCatalogFacetOption>());
        BuildingCatalogFacetState state = new(new[] { first, second }, HasSelection: true);

        Assert.Equal(
            Join(
                new[] { Begin(typeof(BuildingCatalogFacetState)), "PropertyName:groups", "ArrayBegin:2" },
                Record(first),
                Record(second),
                new[] { "ArrayEnd", "PropertyName:hasSelection", "Write:Boolean:True", "TypeEnd" }),
            Record(state));
    }

    [Fact]
    public void FacetState_WithoutGroups_WritesAnEmptyArray()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(BuildingCatalogFacetState)),
                "PropertyName:groups", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:hasSelection", "Write:Boolean:False",
                "TypeEnd",
            },
            Record(new BuildingCatalogFacetState(Array.Empty<BuildingCatalogFacetGroup>(), HasSelection: false)));
    }

    // ---- Facts and footprints ----

    [Fact]
    public void ServiceFact_WritesTheKeyAndADoubleValue()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ServiceFact)),
                "PropertyName:key", "Write:String:capacity",
                "PropertyName:value", "Write:Double:5",
                "TypeEnd",
            },
            Record(new ServiceFact("capacity", 5)));
    }

    [Fact]
    public void ServiceFact_WithANullKey_WritesAnEmptyKey()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ServiceFact)),
                "PropertyName:key", "Write:String:",
                "PropertyName:value", "Write:Double:2.5",
                "TypeEnd",
            },
            Record(new ServiceFact(null!, 2.5)));
    }

    [Fact]
    public void ServiceTextFact_WritesTheKeyAndTheText()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ServiceTextFact)),
                "PropertyName:key", "Write:String:sold",
                "PropertyName:value", "Write:String:Grain",
                "TypeEnd",
            },
            Record(new ServiceTextFact("sold", "Grain")));
    }

    [Fact]
    public void ServiceTextFact_WithNullMembers_WritesEmptyStrings()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ServiceTextFact)),
                "PropertyName:key", "Write:String:",
                "PropertyName:value", "Write:String:",
                "TypeEnd",
            },
            Record(new ServiceTextFact(null!, null!)));
    }

    [Fact]
    public void ZoneFootprint_WritesWidthAndDepthAsIntegers()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ZoneFootprint)),
                "PropertyName:width", "Write:Int32:4",
                "PropertyName:depth", "Write:Int32:2",
                "TypeEnd",
            },
            Record(new ZoneFootprint(4, 2)));
    }

    // ---- Zoning ----

    [Fact]
    public void ZoneCatalogEntry_WithDefaults_WritesZerosEmptiesAndEmptyArrays()
    {
        ZoneCatalogEntry entry = new(7, 3, "ResLow", "Low Residential", "ZoneResidential", ZoneTypeFilter.Low, "zone.svg");

        Assert.Equal(
            new[]
            {
                Begin(typeof(ZoneCatalogEntry)),
                "PropertyName:id", "Write:Int32:7",
                "PropertyName:version", "Write:Int32:3",
                "PropertyName:prefabName", "Write:String:ResLow",
                "PropertyName:name", "Write:String:Low Residential",
                "PropertyName:family", "Write:String:ZoneResidential",
                "PropertyName:density", "Write:String:Low",
                "PropertyName:thumbnail", "Write:String:zone.svg",
                "PropertyName:maxHeight", "Write:Int32:0",
                "PropertyName:supportsNarrow", "Write:Boolean:False",
                "PropertyName:supportsCorners", "Write:Boolean:False",
                "PropertyName:allowedSold", "Write:String:",
                "PropertyName:allowedManufactured", "Write:String:",
                "PropertyName:allowedStored", "Write:String:",
                "PropertyName:minLotWidth", "Write:Int32:0",
                "PropertyName:maxLotWidth", "Write:Int32:0",
                "PropertyName:minLotDepth", "Write:Int32:0",
                "PropertyName:maxLotDepth", "Write:Int32:0",
                "PropertyName:footprints", "ArrayBegin:0", "ArrayEnd",
                "PropertyName:footprintOverflow", "Write:Int32:0",
                "PropertyName:isLocked", "Write:Boolean:False",
                "PropertyName:unlockMilestone", "Write:Int32:0",
                "PropertyName:mapFeature", "Write:String:",
                "PropertyName:unlockRequirements", "ArrayBegin:0", "ArrayEnd",
                "TypeEnd",
            },
            Record(entry));
    }

    [Fact]
    public void ZoneCatalogEntry_WithEveryFieldSet_WritesEachValue()
    {
        ZoneCatalogEntry entry = new(
            Id: 8,
            Version: 2,
            PrefabName: "ComHigh",
            Name: "High Commercial",
            Family: "ZoneCommercial",
            Density: ZoneTypeFilter.High,
            Thumbnail: "com.svg",
            MaxHeight: 120,
            SupportsNarrow: true,
            SupportsCorners: true,
            AllowedSold: "Food",
            AllowedManufactured: "Goods",
            AllowedStored: "Grain",
            MinLotWidth: 2,
            MaxLotWidth: 4,
            MinLotDepth: 3,
            MaxLotDepth: 5,
            Footprints: new[] { new ZoneFootprint(2, 3), new ZoneFootprint(4, 5) },
            FootprintOverflow: 6,
            IsLocked: true,
            UnlockMilestone: 4,
            UnlockRequirements: new[] { "Requirement A", "Requirement B" },
            MapFeature: "Fertile");

        Assert.Equal(
            new[]
            {
                Begin(typeof(ZoneCatalogEntry)),
                "PropertyName:id", "Write:Int32:8",
                "PropertyName:version", "Write:Int32:2",
                "PropertyName:prefabName", "Write:String:ComHigh",
                "PropertyName:name", "Write:String:High Commercial",
                "PropertyName:family", "Write:String:ZoneCommercial",
                "PropertyName:density", "Write:String:High",
                "PropertyName:thumbnail", "Write:String:com.svg",
                "PropertyName:maxHeight", "Write:Int32:120",
                "PropertyName:supportsNarrow", "Write:Boolean:True",
                "PropertyName:supportsCorners", "Write:Boolean:True",
                "PropertyName:allowedSold", "Write:String:Food",
                "PropertyName:allowedManufactured", "Write:String:Goods",
                "PropertyName:allowedStored", "Write:String:Grain",
                "PropertyName:minLotWidth", "Write:Int32:2",
                "PropertyName:maxLotWidth", "Write:Int32:4",
                "PropertyName:minLotDepth", "Write:Int32:3",
                "PropertyName:maxLotDepth", "Write:Int32:5",
                "PropertyName:footprints",
                "ArrayBegin:2",
                Begin(typeof(ZoneFootprint)), "PropertyName:width", "Write:Int32:2", "PropertyName:depth", "Write:Int32:3", "TypeEnd",
                Begin(typeof(ZoneFootprint)), "PropertyName:width", "Write:Int32:4", "PropertyName:depth", "Write:Int32:5", "TypeEnd",
                "ArrayEnd",
                "PropertyName:footprintOverflow", "Write:Int32:6",
                "PropertyName:isLocked", "Write:Boolean:True",
                "PropertyName:unlockMilestone", "Write:Int32:4",
                "PropertyName:mapFeature", "Write:String:Fertile",
                "PropertyName:unlockRequirements", "ArrayBegin:2", "Write:String:Requirement A", "Write:String:Requirement B", "ArrayEnd",
                "TypeEnd",
            },
            Record(entry));
    }

    [Fact]
    public void ZoneCatalogEntry_WithNullStrings_WritesNullWhereThePropertyPassesThemThrough()
    {
        ZoneCatalogEntry entry = new(7, 3, null!, null!, null!, ZoneTypeFilter.Low, null!);

        List<string> tokens = Record(entry);

        foreach (string property in new[] { "prefabName", "name", "family", "thumbnail" })
        {
            Assert.Equal(new[] { NullString }, Written(tokens, property));
        }

        foreach (string property in new[] { "allowedSold", "allowedManufactured", "allowedStored", "mapFeature" })
        {
            Assert.Equal(new[] { "Write:String:" }, Written(tokens, property));
        }
    }

    [Fact]
    public void ZoneCatalogEntry_WithBlankAndNullUnlockRequirements_WritesEveryMemberAsGiven()
    {
        ZoneCatalogEntry entry = new(7, 3, "ResLow", "Low Residential", "ZoneResidential", ZoneTypeFilter.Low, "zone.svg")
        {
            UnlockRequirements = new[] { "keep", null!, " ", string.Empty },
        };

        Assert.Equal(
            new[] { "ArrayBegin:4", "Write:String:keep", NullString, "Write:String: ", "Write:String:", "ArrayEnd" },
            Written(Record(entry), "unlockRequirements"));
    }

    [Fact]
    public void ZoningFamilyDescriptor_WritesTheTooltipUnderALowercaseName()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ZoningFamilyDescriptor)),
                "PropertyName:id", "Write:String:ZoneOffice",
                "PropertyName:icon", "Write:String:Media/Game/Icons/ZoneOffice.svg",
                "PropertyName:tooltip", "Write:String:Zoning_Office",
                "TypeEnd",
            },
            Record(new ZoningFamilyDescriptor("ZoneOffice", "Media/Game/Icons/ZoneOffice.svg", "Zoning_Office")));
    }
    [Fact]
    public void ZoningFamilyDescriptor_WithNullStrings_WritesNull()
    {
        Assert.Equal(
            new[]
            {
                Begin(typeof(ZoningFamilyDescriptor)),
                "PropertyName:id", NullString,
                "PropertyName:icon", NullString,
                "PropertyName:tooltip", NullString,
                "TypeEnd",
            },
            Record(new ZoningFamilyDescriptor(null!, null!, null!)));
    }
}
