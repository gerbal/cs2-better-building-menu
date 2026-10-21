using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests;

public sealed class StringListExtensionsTests
{
    [Fact]
    public void ContainsIgnoreCase_FindsTheValueWhateverItsCase()
    {
        IReadOnlyList<string> list = new[] { "Road", "Water" };

        Assert.True(list.ContainsIgnoreCase("road"));
        Assert.True(list.ContainsIgnoreCase("WATER"));
    }

    [Fact]
    public void ContainsIgnoreCase_MissesAValueTheListLacks()
    {
        IReadOnlyList<string> list = new List<string> { "Road", "Water" };

        Assert.False(list.ContainsIgnoreCase("Rail"));
        Assert.False(list.ContainsIgnoreCase("Roads"));
        Assert.False(list.ContainsIgnoreCase(null));
    }

    [Fact]
    public void ContainsIgnoreCase_HoldsNothingForAMissingOrEmptyList()
    {
        IReadOnlyList<string>? missing = null;

        Assert.False(missing.ContainsIgnoreCase("Road"));
        Assert.False(Array.Empty<string>().ContainsIgnoreCase("Road"));
    }

    [Fact]
    public void ContainsIgnoreCase_FoldsByOrdinalRulesWhateverTheCulture()
    {
        var before = Thread.CurrentThread.CurrentCulture;

        try
        {
            Thread.CurrentThread.CurrentCulture = new System.Globalization.CultureInfo("tr-TR");

            Assert.True(new[] { "Industrial" }.ContainsIgnoreCase("INDUSTRIAL"));
            Assert.False(new[] { "Industrial" }.ContainsIgnoreCase("İndustrial"));
        }
        finally
        {
            Thread.CurrentThread.CurrentCulture = before;
        }
    }
}
