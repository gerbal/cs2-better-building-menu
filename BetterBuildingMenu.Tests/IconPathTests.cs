using BetterBuildingMenu.Utilities;

namespace BetterBuildingMenu.Tests;

public sealed class IconPathTests
{
    [Theory]
    [InlineData("coui://uil/Colored/Road.svg", "coui://betterbuildingmenu/Icons/Colored/Road.svg")]
    [InlineData("coui://uil/Standard/StarAll.svg", "coui://betterbuildingmenu/Icons/Standard/StarAll.svg")]
    public void Normalize_RehomesUnifiedIconLibraryPaths(string source, string expected)
    {
        Assert.Equal(expected, IconPath.Normalize(source));
    }

    [Theory]
    [InlineData("Media/Game/Icons/Roads.svg")]
    [InlineData("coui://betterbuildingmenu/YesParking.svg")]
    [InlineData("")]
    public void Normalize_PreservesNonUnifiedPaths(string source)
    {
        Assert.Equal(source, IconPath.Normalize(source));
    }
}
