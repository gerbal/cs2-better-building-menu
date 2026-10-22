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

        indexer.BumpState();

        Assert.Equal(1, indexer.Generation);
        Assert.Equal(0, indexer.ContentGeneration);
    }

    [Fact]
    public void BumpContent_MovesTheGenerationWithTheContentGeneration()
    {
        var indexer = Uninitialized();

        indexer.BumpContent();
        indexer.BumpState();
        indexer.BumpContent();

        Assert.Equal(3, indexer.Generation);
        Assert.Equal(2, indexer.ContentGeneration);
    }

    private static PrefabIndexingSystem Uninitialized() =>
        (PrefabIndexingSystem)RuntimeHelpers.GetUninitializedObject(typeof(PrefabIndexingSystem));
}
