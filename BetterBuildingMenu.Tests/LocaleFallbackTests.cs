using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests;

public sealed class LocaleFallbackTests
{
    private static readonly Dictionary<string, string> English = new()
    {
        ["Options.OPTION[Replace]"] = "Replace the build menu",
        ["Tooltip.LABEL[Search]"] = "Search",
    };

    [Fact]
    public void Merge_KeepsTheTranslationWhereThereIsOne()
    {
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string> { ["Tooltip.LABEL[Search]"] = "Suche" });

        Assert.Equal("Suche", merged["Tooltip.LABEL[Search]"]);
    }

    [Fact]
    public void Merge_FillsEveryKeyTheTranslationLacksWithEnglish()
    {
        // The translations cover 71 of 271 keys, the Options screen's labels among
        // the missing: each gap reads as English, never as the raw key.
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string> { ["Tooltip.LABEL[Search]"] = "Suche" });

        Assert.Equal("Replace the build menu", merged["Options.OPTION[Replace]"]);
        Assert.Equal(English.Count, merged.Count);
    }

    [Fact]
    public void Merge_TreatsABlankTranslationAsMissing()
    {
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string> { ["Tooltip.LABEL[Search]"] = " " });

        Assert.Equal("Search", merged["Tooltip.LABEL[Search]"]);
    }

    [Fact]
    public void Merge_LeavesTheEnglishTableUntouched()
    {
        LocaleFallback.Merge(English, new Dictionary<string, string> { ["Tooltip.LABEL[Search]"] = "Suche", ["Extra"] = "Nur hier" });

        Assert.Equal("Search", English["Tooltip.LABEL[Search]"]);
        Assert.False(English.ContainsKey("Extra"));
    }

    [Fact]
    public void Merge_WithNoTranslationIsEnglish()
    {
        Assert.Equal(English, LocaleFallback.Merge(English, null));
    }
}
