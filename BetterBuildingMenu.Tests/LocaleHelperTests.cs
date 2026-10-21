using BetterBuildingMenu.Utilities;

namespace BetterBuildingMenu.Tests;

// These run without a game, so no localization manager answers: the contract under test is that
// every lookup then says "no words" instead of throwing, which is what keeps the labels testable.
public sealed class LocaleHelperTests
{
    [Fact]
    public void TryTranslate_IsNullWithoutAGame()
    {
        Assert.Null(LocaleHelper.TryTranslate("Services.NAME[Roads]"));
    }

    [Fact]
    public void TryTranslate_IsNullForAMissingKey()
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

    [Fact]
    public void Translate_FallsBackToTheFallbackThenToTheKey()
    {
        Assert.Equal("Roads", LocaleHelper.Translate("Services.NAME[Roads]", "Roads"));
        Assert.Equal("Services.NAME[Roads]", LocaleHelper.Translate("Services.NAME[Roads]"));
    }
}
