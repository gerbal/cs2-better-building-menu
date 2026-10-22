using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests;

public sealed class DictionaryExtensionsTests
{
    [Fact]
    public void GetOrAdd_StoresWhatTheFactoryMakesWhenTheKeyIsMissing()
    {
        var map = new Dictionary<string, List<int>>();

        var made = map.GetOrAdd("Roads", () => new List<int>());
        made.Add(7);

        Assert.Same(made, map["Roads"]);
        Assert.Equal(new[] { 7 }, map["Roads"]);
    }

    [Fact]
    public void GetOrAdd_ReturnsTheStoredValueWithoutCallingTheFactory()
    {
        var existing = new List<int> { 1 };
        var map = new Dictionary<string, List<int>> { ["Roads"] = existing };
        var calls = 0;

        var found = map.GetOrAdd("Roads", () =>
        {
            calls++;
            return new List<int>();
        });

        Assert.Same(existing, found);
        Assert.Equal(0, calls);
    }

    [Fact]
    public void GetOrAdd_KeepsOneListPerKeyAcrossRepeatedAdds()
    {
        var map = new Dictionary<string, List<string>>(StringComparer.Ordinal);

        map.GetOrAdd("Zones", () => new List<string>()).Add("a");
        map.GetOrAdd("Zones", () => new List<string>()).Add("b");
        map.GetOrAdd("Roads", () => new List<string>()).Add("c");

        Assert.Equal(new[] { "a", "b" }, map["Zones"]);
        Assert.Equal(new[] { "c" }, map["Roads"]);
    }
}
