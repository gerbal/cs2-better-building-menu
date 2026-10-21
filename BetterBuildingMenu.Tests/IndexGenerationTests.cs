using System.Reflection;
using System.Runtime.CompilerServices;

using BetterBuildingMenu.Systems;

namespace BetterBuildingMenu.Tests;

// The indexer needs a running world, so it is built without its constructor and only its two
// counters are read: the bumps touch nothing else.
public sealed class IndexGenerationTests
{
    [Fact]
    public void BumpState_MovesOnlyTheGeneration()
    {
        var indexer = Uninitialized();

        Invoke(indexer, "BumpState");

        Assert.Equal(1, indexer.Generation);
        Assert.Equal(0, indexer.ContentGeneration);
    }

    [Fact]
    public void BumpContent_MovesTheGenerationWithTheContentGeneration()
    {
        var indexer = Uninitialized();

        Invoke(indexer, "BumpContent");
        Invoke(indexer, "BumpState");
        Invoke(indexer, "BumpContent");

        Assert.Equal(3, indexer.Generation);
        Assert.Equal(2, indexer.ContentGeneration);
    }

    private static PrefabIndexingSystem Uninitialized() =>
        (PrefabIndexingSystem)RuntimeHelpers.GetUninitializedObject(typeof(PrefabIndexingSystem));

    private static void Invoke(PrefabIndexingSystem indexer, string name) =>
        typeof(PrefabIndexingSystem)
            .GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic)!
            .Invoke(indexer, null);
}
