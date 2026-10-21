using BetterBuildingMenu.Utilities;

namespace BetterBuildingMenu.Tests;

// No game runs here, so no localization manager answers and every lookup must say "no words"
// rather than throw. A dictionary cannot be built without the game, so the trim and blank rule
// TryTranslate takes from WordFormat.GameText is covered by WordFormatTests.
public sealed class LocaleHelperTests
{
    [Fact]
    public void TryTranslate_IsNullWithoutAGame()
    {
        Assert.Null(LocaleHelper.TryTranslate("Services.NAME[Roads]"));
    }

    [Fact]
    public void TryTranslate_IsNullForANullKey()
    {
        Assert.Null(LocaleHelper.TryTranslate(null));
    }

    [Fact]
    public void FirstTranslated_FallsBackWhenNoKeyTranslates()
    {
        Assert.Equal("Roads", LocaleHelper.FirstTranslated("SubServices.NAME[Roads]", "Services.NAME[Roads]", "Roads"));
        Assert.Equal("Roads", LocaleHelper.FirstTranslated("Services.NAME[Roads]", null, "Roads"));
        Assert.Equal("Roads", LocaleHelper.FirstTranslated(null, null, "Roads"));
    }
}
