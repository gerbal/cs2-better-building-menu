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
        // The Options screen reads these with no fallback of its own, and no
        // translation carries them, so a gap there reaches the player as a raw id.
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

    [Fact]
    public void UntranslatedKeys_IsNoneInEnglish()
    {
        Assert.Empty(LocaleFallback.UntranslatedKeys(LocaleFallback.EnglishLocaleId, English, null));
    }

    [Fact]
    public void UntranslatedKeys_NamesEachKeyOfOursTheTranslationLacksOrLeavesBlank()
    {
        // The game fills a gap in the active language from English, so a key the translation
        // lacks still resolves: only this list says the English is not the player's language.
        var german = new Dictionary<string, string> { [OptionKey] = "Baumenü ersetzen", [LabelKey] = " " };

        Assert.Equal(new[] { LabelKey }, LocaleFallback.UntranslatedKeys("de-DE", English, german));
        Assert.Equal(new[] { OptionKey }, LocaleFallback.UntranslatedKeys("de-DE", English, new Dictionary<string, string> { [LabelKey] = "Suche" }));
    }

    [Fact]
    public void UntranslatedKeys_IsEveryKeyOfOursInALanguageWithNoTranslation()
    {
        Assert.Equal(new[] { OptionKey, LabelKey }, LocaleFallback.UntranslatedKeys("nl-NL", English, null));
    }
}
