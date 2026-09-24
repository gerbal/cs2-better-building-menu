using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests;

public sealed class InteractionBoundaryTests
{
    [Fact]
    public void TryActivatePrefab_DoesNotDelegateForInvalidOrUnavailablePrefabs()
    {
        var activatedIds = new List<int>();
        var boundary = new InteractionBoundary();

        Assert.False(boundary.TryActivatePrefab(0, isAvailable: true, isAlreadyActive: false, () => activatedIds.Add(0)));
        Assert.False(boundary.TryActivatePrefab(10, isAvailable: false, isAlreadyActive: false, () => activatedIds.Add(10)));

        Assert.Empty(activatedIds);
    }

    [Fact]
    public void TryActivatePrefab_DoesNotDelegateForTheActivePrefab()
    {
        var activatedIds = new List<int>();
        var boundary = new InteractionBoundary();

        Assert.False(boundary.TryActivatePrefab(10, isAvailable: true, isAlreadyActive: true, () => activatedIds.Add(10)));

        Assert.Empty(activatedIds);
    }

    [Fact]
    public void TryActivatePrefab_DelegatesANewAvailablePrefab()
    {
        var activatedIds = new List<int>();
        var boundary = new InteractionBoundary();

        Assert.True(boundary.TryActivatePrefab(10, isAvailable: true, isAlreadyActive: false, () => activatedIds.Add(10)));

        Assert.Equal(new[] { 10 }, activatedIds);
    }
}
