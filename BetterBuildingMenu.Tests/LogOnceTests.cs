using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests;

public sealed class LogOnceTests
{
    [Fact]
    public void IsFirst_IsTrueOnlyTheFirstTime()
    {
        var once = new LogOnce();

        Assert.True(once.IsFirst());
        Assert.False(once.IsFirst());
        Assert.False(once.IsFirst());
    }

    [Fact]
    public void IsFirst_CountsEachKeyOnce()
    {
        var once = new LogOnce();

        Assert.True(once.IsFirst("m_ToolbarGroupsBinding"));
        Assert.True(once.IsFirst("m_AssetMenuCategoriesBinding"));
        Assert.False(once.IsFirst("m_ToolbarGroupsBinding"));
    }

    [Fact]
    public void IsFirst_KeysAreOrdinal()
    {
        var once = new LogOnce();

        Assert.True(once.IsFirst("field"));
        Assert.True(once.IsFirst("Field"));
    }

    [Fact]
    public void IsFirst_KeepsTheKeylessAndKeyedCountsApart()
    {
        var once = new LogOnce();

        Assert.True(once.IsFirst("field"));
        Assert.True(once.IsFirst());
        Assert.False(once.IsFirst());
        Assert.False(once.IsFirst("field"));
    }
}
