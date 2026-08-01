using Colossal.UI.Binding;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using FindItBuildingMenu.Utilities;

using System.Collections.Generic;

namespace FindItBuildingMenu.Tests;

public sealed class BuildingCatalogQueryEngineTests
{
    private static readonly IReadOnlyList<BuildingCatalogEntry> SampleEntries = new[]
    {
        Entry(1, "CoalPlant", "Coal Power Plant", "Buildings", "Buildings_Industrial", 4, 3, 3, false, "") with
        {
            ConstructionCost = 80000,
            Upkeep = 5000,
            Workers = 40,
            Capacity = 200,
            ElectricityConsumption = 100,
            WaterConsumption = 20,
        },
        Entry(2, "WindTurbine", "Wind Turbine", "Buildings", "Buildings_Specialized", 2, 2, 1, true, "") with
        {
            ConstructionCost = 25000,
            Upkeep = 200,
            Workers = 2,
            ElectricityConsumption = 0,
        },
        Entry(3, "WaterPumpingStation", "Water Pumping Station", "ServiceBuildings", "ServiceBuildings_Water", 3, 4, 2, true, "12345") with
        {
            ConstructionCost = 45000,
            Upkeep = 1500,
            Workers = 12,
            Capacity = 1000,
            WaterCapacity = 1000,
            ElectricityConsumption = 30,
            WaterConsumption = 5,
        },
        Entry(4, "SmallClinic", "Small Clinic", "ServiceBuildings", "ServiceBuildings_Health", 3, 2, 2, false, "") with
        {
            ConstructionCost = 5000,
            Upkeep = 50,
            Workers = 4,
            Capacity = 20,
        },
        Entry(5, "ZonedOffice", "Office Block", "Buildings", "Buildings_Office", 5, 4, 4, true, "") with
        {
            ConstructionCost = 12000,
            Upkeep = 450,
            Workers = 80,
            Capacity = 300,
        },
    };

    [Fact]
    public void Query_SearchAndCategoryFilters_AreCaseInsensitive()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "POWER", Category: "buildings"));

        BuildingCatalogEntry entry = Assert.Single(page.Items);
        Assert.Equal(1, entry.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public void Query_SearchAlsoMatchesPrefabAndPdxIds()
    {
        BuildingCatalogPage prefabPage = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "windturbine"));
        BuildingCatalogPage pdxPage = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "12345"));

        Assert.Equal(2, Assert.Single(prefabPage.Items).Id);
        Assert.Equal(3, Assert.Single(pdxPage.Items).Id);
    }

    [Fact]
    public void Query_RangeSubcategoryAndParkingFilters_UseInclusiveBounds()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(
                SubCategory: "ServiceBuildings_Health",
                MinLotWidth: 3,
                MaxLotWidth: 3,
                MinLotDepth: 2,
                MaxLotDepth: 2,
                MinBuildingLevel: 2,
                MaxBuildingLevel: 2,
                HasParking: false));

        BuildingCatalogEntry entry = Assert.Single(page.Items);
        Assert.Equal(4, entry.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public void Query_NumericSortAndStableIdTieBreak_WorkInBothDirections()
    {
        BuildingCatalogPage ascending = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SortColumn: "LotWidth"));
        BuildingCatalogPage descending = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SortColumn: "BuildingLevel", Descending: true));

        Assert.Equal(new[] { 2, 3, 4, 1, 5 }, ascending.Items.Select(item => item.Id).ToArray());
        Assert.Equal(new[] { 5, 1, 3, 4, 2 }, descending.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void Query_PagesAfterFilteringAndReportsUnpagedTotal()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Category: "Buildings", Offset: 1, Limit: 2));

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(1, page.Offset);
        Assert.Equal(2, page.Limit);
        Assert.Equal(new[] { 5, 2 }, page.Items.Select(item => item.Id).ToArray());
    }

    [Theory]
    [InlineData(-1, 1)]
    [InlineData(0, 1)]
    [InlineData(37, 37)]
    [InlineData(501, 500)]
    public void Query_NormalizesBoundsBeforePaging(int requestedLimit, int expectedLimit)
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: requestedLimit));

        Assert.Equal(expectedLimit, page.Limit);
        Assert.Equal(Math.Min(expectedLimit, SampleEntries.Count), page.Items.Count);
    }

    [Fact]
    public void Query_EmptyAndMissingFields_ReturnEmptyWithoutThrowing()
    {
        BuildingCatalogEntry empty = Entry(6, "", "", "", "", 0, 0, 0, false, "");

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            new[] { empty },
            new BuildingCatalogQuery(SearchText: "missing", SortColumn: "Unknown"));
        BuildingCatalogPage noSource = BuildingCatalogQueryEngine.Query(
            Array.Empty<BuildingCatalogEntry>(),
            new BuildingCatalogQuery());

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Empty(noSource.Items);
        Assert.Equal(0, noSource.TotalCount);
    }

    [Fact]
	public void Query_AnalyticalRangesExcludeMissingValuesAndUseInclusiveBounds()
	{
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(
                MinConstructionCost: 12000,
                MaxConstructionCost: 45000,
                MinWorkers: 2,
                MaxWorkers: 12));

        Assert.Equal(new[] { 3, 2 }, page.Items.Select(item => item.Id).ToArray());
        Assert.Equal(2, page.TotalCount);

        BuildingCatalogPage capacityPage = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(MinCapacity: 20, MaxCapacity: 1000));

        Assert.Equal(new[] { 1, 5, 4, 3 }, capacityPage.Items.Select(item => item.Id).ToArray());
        Assert.Equal(4, capacityPage.TotalCount);

        BuildingCatalogPage missing = BuildingCatalogQueryEngine.Query(
            new[] { Entry(6, "NoMetrics", "No metrics", "Buildings", "", 1, 1, 1, false, "") },
            new BuildingCatalogQuery(MinUpkeep: 0));

		Assert.Empty(missing.Items);
	}

	[Fact]
	public void Query_EducationCapacityFloorIsCategoryScopedAndInclusive()
	{
		BuildingCatalogEntry smallSchool = Entry(
			7,
			"ElementarySchool",
			"Elementary School",
			"ServiceBuildings",
			"ServiceBuildings_EducationResearch",
			4,
			4,
			2,
			false,
			"") with { Capacity = 100 };
		BuildingCatalogEntry missingCapacity = smallSchool with { Id = 8, PrefabName = "ResearchCenter", Name = "Research Center", Capacity = null };

		BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
			SampleEntries.Concat(new[] { smallSchool, missingCapacity }),
			new BuildingCatalogQuery(
				Category: "servicebuildings",
				SubCategory: "servicebuildings_educationresearch",
				MinCapacity: 100));

		BuildingCatalogEntry entry = Assert.Single(page.Items);
		Assert.Equal(7, entry.Id);
		Assert.Equal(1, page.TotalCount);
	}

    [Fact]
    public void Query_AnalyticalSortKeepsMissingValuesLastAndUsesIdTieBreak()
    {
        BuildingCatalogEntry missing = Entry(6, "NoCost", "No cost", "Buildings", "", 1, 1, 1, false, "");
        BuildingCatalogEntry sameCost = Entry(7, "SameCost", "Same cost", "Buildings", "", 1, 1, 1, false, "") with { ConstructionCost = 5000 };

        BuildingCatalogPage ascending = BuildingCatalogQueryEngine.Query(
            SampleEntries.Concat(new[] { missing, sameCost }),
            new BuildingCatalogQuery(SortColumn: "Cost"));
        BuildingCatalogPage descending = BuildingCatalogQueryEngine.Query(
            SampleEntries.Concat(new[] { missing, sameCost }),
            new BuildingCatalogQuery(SortColumn: "Upkeep", Descending: true));

        Assert.Equal(new[] { 4, 7, 5, 2, 3, 1, 6 }, ascending.Items.Select(item => item.Id).ToArray());
        Assert.Equal(new[] { 1, 3, 5, 2, 4, 6, 7 }, descending.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void Query_RejectsNullInputs()
    {
        Assert.Throws<ArgumentNullException>(() => BuildingCatalogQueryEngine.Query(
            null!,
            new BuildingCatalogQuery()));
        Assert.Throws<ArgumentNullException>(() => BuildingCatalogQueryEngine.Query(
            SampleEntries,
            null!));
    }

    [Fact]
    public void Adapter_WhenFindItIndexIsUnready_ReturnsAnEmptyBoundedPage()
    {
        bool previousReady = FindItUtil.IsReady;
        try
        {
            FindItUtil.IsReady = false;

            BuildingCatalogPage page = new BuildingCatalogAdapter().Query(
                new BuildingCatalogQuery(Limit: 501));

            Assert.Empty(page.Items);
            Assert.Equal(0, page.TotalCount);
            Assert.Equal(500, page.Limit);
        }
        finally
        {
            FindItUtil.IsReady = previousReady;
        }
    }

    [Fact]
    public void FindItUtil_WhenIndexCategoriesAreMissing_ReturnsEmptyCollections()
    {
        bool previousReady = FindItUtil.IsReady;
        PrefabCategory previousCategory = FindItUtil.CurrentCategory;
        PrefabSubCategory previousSubCategory = FindItUtil.CurrentSubCategory;
        KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>>[] previousCategories =
            FindItUtil.CategorizedPrefabs.ToArray();

        try
        {
            FindItUtil.CategorizedPrefabs.Clear();
            FindItUtil.CurrentCategory = PrefabCategory.Any;
            FindItUtil.CurrentSubCategory = PrefabSubCategory.Any;
            FindItUtil.IsReady = true;

            Assert.Empty(FindItUtil.GetSubCategories());
            Assert.Empty(FindItUtil.GetFilteredPrefabs());
            Assert.Empty(FindItUtil.GetUnfilteredPrefabs());
            Assert.Null(FindItUtil.GetPrefabBase(0));
            Assert.Null(FindItUtil.GetPrefabIndex(0));
        }
        finally
        {
            FindItUtil.CategorizedPrefabs.Clear();
            foreach (KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> category in previousCategories)
            {
                FindItUtil.CategorizedPrefabs[category.Key] = category.Value;
            }

            FindItUtil.IsReady = previousReady;
            FindItUtil.CurrentCategory = previousCategory;
            FindItUtil.CurrentSubCategory = previousSubCategory;
        }
    }

    [Fact]
    public void PageWrite_EmitsStablePageAndEntryPropertyNames()
    {
        BuildingCatalogPage page = new(
            new[] { SampleEntries[0] },
            TotalCount: 1,
            Offset: 0,
            Limit: 100);
        RecordingJsonWriter writer = new();

        page.Write(writer);

        Assert.Equal(
            new[] { "items", "id", "prefabName", "name", "category", "subCategory", "thumbnail", "lotWidth", "lotDepth", "buildingLevel", "zoneType", "hasParking", "isUniqueMesh", "isVanilla", "isFavorited", "pdxModsId", "constructionCost", "upkeep", "workers", "capacity", "electricityConsumption", "waterConsumption", "garbageAccumulation", "waterCapacity", "sewageCapacity", "groundPollution", "airPollution", "noisePollution", "totalCount", "offset", "limit" },
            writer.PropertyNames);
        Assert.Contains("Write:Int32:1", writer.Tokens);
        Assert.Contains("Write:String:Coal Power Plant", writer.Tokens);
        Assert.Contains("Write:Int32:100", writer.Tokens);
        Assert.Contains("Write:Double:80000", writer.Tokens);
    }

    private static BuildingCatalogEntry Entry(
        int id,
        string prefabName,
        string name,
        string category,
        string subCategory,
        int lotWidth,
        int lotDepth,
        int buildingLevel,
        bool hasParking,
        string pdxModsId)
    {
        return new BuildingCatalogEntry(
            Id: id,
            PrefabName: prefabName,
            Name: name,
            Category: category,
            SubCategory: subCategory,
            Thumbnail: string.Empty,
            LotWidth: lotWidth,
            LotDepth: lotDepth,
            BuildingLevel: buildingLevel,
            ZoneType: ZoneTypeFilter.Any,
            HasParking: hasParking,
            IsUniqueMesh: false,
            IsVanilla: true,
            IsFavorited: false,
            PdxModsId: pdxModsId);
    }

    private sealed class RecordingJsonWriter : IJsonWriter
    {
        public List<string> Tokens { get; } = new();

        public IReadOnlyList<string> PropertyNames => Tokens
            .Where(token => token.StartsWith("PropertyName:", StringComparison.Ordinal))
            .Select(token => token["PropertyName:".Length..])
            .ToArray();

        public string debugName => nameof(RecordingJsonWriter);

        public void TypeBegin(string typeName) => Tokens.Add("TypeBegin:" + typeName);
        public void TypeEnd() => Tokens.Add("TypeEnd");
        public void MapBegin(uint size) => Tokens.Add("MapBegin:" + size);
        public void MapEnd() => Tokens.Add("MapEnd");
        public void ArrayBegin(uint size) => Tokens.Add("ArrayBegin:" + size);
        public void ArrayEnd() => Tokens.Add("ArrayEnd");
        public void PropertyName(string name) => Tokens.Add("PropertyName:" + name);
        public void WriteNull() => Tokens.Add("WriteNull");
        public void Write(bool value) => Tokens.Add("Write:Boolean:" + value);
        public void Write(int value) => Tokens.Add("Write:Int32:" + value);
        public void Write(uint value) => Tokens.Add("Write:UInt32:" + value);
        public void Write(long value) => Tokens.Add("Write:Int64:" + value);
        public void Write(ulong value) => Tokens.Add("Write:UInt64:" + value);
        public void Write(float value) => Tokens.Add("Write:Single:" + value);
        public void Write(double value) => Tokens.Add("Write:Double:" + value);
        public void Write(string value) => Tokens.Add("Write:String:" + value);
    }
}
