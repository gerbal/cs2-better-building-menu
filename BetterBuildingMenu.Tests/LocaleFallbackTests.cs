using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests;

public sealed class LocaleFallbackTests
{
    private const string OptionKey = "Options.OPTION[Replace]";
    private const string LabelKey = "Tooltip.LABEL[Search]";

    private static readonly Dictionary<string, string> English = new()
    {
        [OptionKey] = "Replace the build menu",
        [LabelKey] = "Search",
    };

    [Fact]
    public void Merge_KeepsTheTranslationWhereThereIsOne()
    {
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string> { [OptionKey] = "Baumenü ersetzen" });

        Assert.Equal("Baumenü ersetzen", merged[OptionKey]);
    }

    [Fact]
    public void Merge_FillsAMissingOptionsKeyWithEnglish()
    {
        // The Options screen reads these with no fallback of its own; none of the 13
        // translations carries them, so a gap there reached the player as a raw id.
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string>());

        Assert.Equal("Replace the build menu", merged[OptionKey]);
    }

    [Fact]
    public void Merge_LeavesEveryOtherMissingKeyMissing()
    {
        // The UI asks for these with an English fallback of its own, and some it asks
        // first so that a gap falls through to the game's translated name (the Roads
        // menu). Filling them with English would hide the game's German, French, ...
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string>());

        Assert.False(merged.ContainsKey(LabelKey));
    }

    [Fact]
    public void Merge_TreatsABlankTranslationAsMissing()
    {
        var merged = LocaleFallback.Merge(English, new Dictionary<string, string> { [OptionKey] = " ", [LabelKey] = "" });

        Assert.Equal("Replace the build menu", merged[OptionKey]);
        Assert.False(merged.ContainsKey(LabelKey));
    }

    [Fact]
    public void Merge_LeavesTheEnglishTableUntouched()
    {
        LocaleFallback.Merge(English, new Dictionary<string, string> { [OptionKey] = "Ersetzen", ["Extra"] = "Nur hier" });

        Assert.Equal("Replace the build menu", English[OptionKey]);
        Assert.False(English.ContainsKey("Extra"));
    }
}
