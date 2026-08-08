using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Tests;

public sealed class BuildingLensRoleScopeTests
{
    private static BuildingCatalogEntry Entry(int id, string? role) => new(
        Id: id,
        PrefabName: $"Prefab{id}",
        Name: $"Name{id}",
        Category: "ServiceBuildings",
        SubCategory: "ServiceBuildings_Police",
        Thumbnail: string.Empty,
        LotWidth: 1,
        LotDepth: 1,
        BuildingLevel: 1,
        ZoneType: ZoneTypeFilter.Any,
        HasParking: false,
        IsUniqueMesh: false,
        IsVanilla: true,
        IsFavorited: false,
        PdxModsId: string.Empty,
        BuildingType: role);

    [Fact]
    public void GetDescriptors_ReturnsEmptyWithFewerThanTwoRealRoles()
    {
        // Transportation measures 41 buildings and zero role groups; a single
        // role (or none at all) has nowhere to switch to, and a lone tab
        // beside "All" would just duplicate what "All" already shows. The UI
        // reads an empty list as "drop the strip entirely".
        Assert.Empty(BuildingLensRoleScope.GetDescriptors(Array.Empty<BuildingCatalogEntry>()));
        Assert.Empty(BuildingLensRoleScope.GetDescriptors(new[] { Entry(1, "PoliceStation") }));
        Assert.Empty(BuildingLensRoleScope.GetDescriptors(new[]
        {
            Entry(1, "PoliceStation"),
            Entry(2, "PoliceStation"),
            Entry(3, null),
        }));
    }

    [Fact]
    public void GetDescriptors_LeadsWithAnAllEntryThenOrdersKnownRolesByPriority()
    {
        // Police & Administration measures Police Station and Prison, in that
        // priority order (BuildingRole.Known lists PoliceStation ahead of
        // Prison), behind a leading "All" tab — otherwise picking a role tab
        // has no way back to the unscoped section.
        IReadOnlyList<VanillaBuildMenuDescriptor> descriptors = BuildingLensRoleScope.GetDescriptors(new[]
        {
            Entry(1, "Prison"),
            Entry(2, "PoliceStation"),
            Entry(3, "PoliceStation"),
            Entry(4, null),
        });

        Assert.Equal(
            new[] { VanillaBuildMenuTaxonomy.Any, "PoliceStation", "Prison" },
            descriptors.Select(descriptor => descriptor.Id).ToArray());
    }

    [Fact]
    public void GetDescriptors_AppendsRolesOutsideThePriorityListAlphabeticallyAfterTheKnownOnes()
    {
        // A service component this build has no priority entry for still
        // needs a tab; it should not be silently dropped, but a known role
        // still outranks it the same way BuildingRole.ResolvePrimary prefers
        // a known role over an unknown one.
        IReadOnlyList<VanillaBuildMenuDescriptor> descriptors = BuildingLensRoleScope.GetDescriptors(new[]
        {
            Entry(1, "ZetaModRole"),
            Entry(2, "School"),
            Entry(3, "AlphaModRole"),
        });

        Assert.Equal(
            new[] { VanillaBuildMenuTaxonomy.Any, "School", "AlphaModRole", "ZetaModRole" },
            descriptors.Select(descriptor => descriptor.Id).ToArray());
    }

    [Fact]
    public void GetDescriptors_GivesEveryRoleAnIconAndALabelKey()
    {
        IReadOnlyList<VanillaBuildMenuDescriptor> descriptors = BuildingLensRoleScope.GetDescriptors(new[]
        {
            Entry(1, "PowerPlant"),
            Entry(2, "School"),
        });

        VanillaBuildMenuDescriptor all = descriptors.Single(descriptor => descriptor.Id == VanillaBuildMenuTaxonomy.Any);
        VanillaBuildMenuDescriptor powerPlant = descriptors.Single(descriptor => descriptor.Id == "PowerPlant");
        VanillaBuildMenuDescriptor school = descriptors.Single(descriptor => descriptor.Id == "School");

        Assert.Equal(VanillaBuildMenuTaxonomy.Any, all.Tooltip);
        Assert.NotEmpty(all.Icon);
        // PowerPlant was missing from RoleOption's icon map; part of this task
        // is filling that gap in rather than leaving the lens tab iconless.
        Assert.Equal("Media/Game/Icons/Electricity.svg", powerPlant.Icon);
        Assert.Equal("RolePowerPlant", powerPlant.Tooltip);
        Assert.Equal("Media/Game/Icons/Education.svg", school.Icon);
        Assert.Equal("RoleSchool", school.Tooltip);
    }

    [Fact]
    public void GetDescriptors_RejectsNullInput()
    {
        Assert.Throws<ArgumentNullException>(() => BuildingLensRoleScope.GetDescriptors(null!));
    }
}
