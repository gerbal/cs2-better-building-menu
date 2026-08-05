using Colossal.UI.Binding;

namespace FindItBuildingMenu.Domain;

/// <summary>
/// Stable identifiers for construction surfaces that are not building-table
/// records. These values cross the C# / Gameface boundary and must not change
/// when the vanilla toolbar's runtime entities change.
/// </summary>
public static class ToolSurfaceIds
{
    public const string Roads = "Roads";
    public const string Paths = "Paths";
    public const string LotTerraform = "LotTerraform";
    public const string Vegetation = "Vegetation";
    public const string Props = "Props";
    public const string Vehicles = "Vehicles";
}

/// <summary>
/// Actions understood by the UI-side vanilla toolbar resolver.
/// </summary>
public static class ToolSurfaceActions
{
    public const string NativeAssetMenu = "NativeAssetMenu";
    public const string NativeAssetCategory = "NativeAssetCategory";
    public const string NativeTool = "NativeTool";
    public const string Unavailable = "Unavailable";
}

/// <summary>
/// A flat, serializable descriptor for one non-building construction surface.
/// Aliases are runtime toolbar labels/tags, never persisted entity IDs.
/// </summary>
public sealed record ToolSurfaceDescriptor(
    string Id,
    string Icon,
    string ToolTip,
    string Action,
    string[] Aliases) : IJsonWritable
{
    public void Write(IJsonWriter writer)
    {
        writer.TypeBegin(GetType().FullName);
        writer.PropertyName("id");
        writer.Write(Id);
        writer.PropertyName("icon");
        writer.Write(Icon);
        writer.PropertyName("toolTip");
        writer.Write(ToolTip);
        writer.PropertyName("action");
        writer.Write(Action);
        writer.PropertyName("aliases");
        writer.ArrayBegin((uint)Aliases.Length);
        foreach (string alias in Aliases)
        {
            writer.Write(alias);
        }

        writer.ArrayEnd();
        writer.TypeEnd();
    }
}

/// <summary>
/// The bounded descriptor catalog exposed while Building Lens is active.
/// Native toolbar resolution remains a UI concern because the toolbar's entity
/// IDs are created at runtime by the game.
/// </summary>
public static class ToolSurfaceCatalog
{
    private static readonly ToolSurfaceDescriptor[] Descriptors =
    {
        new(
            ToolSurfaceIds.Roads,
            "coui://finditbuildingmenu/Icons/Colored/Road.svg",
            "ToolSurface_Roads",
            ToolSurfaceActions.NativeAssetMenu,
            new[] { "Roads", "Networks", "NetTool" }),
        new(
            ToolSurfaceIds.Paths,
            "coui://finditbuildingmenu/Icons/Colored/PedestrianPath.svg",
            "ToolSurface_Paths",
            ToolSurfaceActions.NativeAssetCategory,
            new[] { "Pathways", "PedestrianPath", "Paths", "Path" }),
        new(
            ToolSurfaceIds.LotTerraform,
            "Media/Game/Icons/LotTool.svg",
            "ToolSurface_LotTerraform",
            ToolSurfaceActions.NativeAssetCategory,
            new[] { "Terraforming", "LotTool", "Terraform", "Terrain Tool" }),
        new(
            ToolSurfaceIds.Vegetation,
            "coui://finditbuildingmenu/Icons/Colored/Nature.svg",
            "ToolSurface_Vegetation",
            ToolSurfaceActions.NativeAssetCategory,
            new[] { "Vegetation", "Trees", "Nature" }),
        new(
            ToolSurfaceIds.Props,
            "coui://finditbuildingmenu/Icons/Colored/BenchAndLampProps.svg",
            "ToolSurface_Props",
            ToolSurfaceActions.NativeAssetMenu,
            new[] { "Landscaping", "Props", "Prop" }),
        new(
            ToolSurfaceIds.Vehicles,
            "coui://finditbuildingmenu/Icons/Colored/GenericVehicleIsometric.svg",
            "ToolSurface_Vehicles",
            ToolSurfaceActions.NativeAssetMenu,
            new[] { "Transportation", "Vehicles", "Vehicle" }),
    };

    public static IReadOnlyList<ToolSurfaceDescriptor> GetDescriptors() => Descriptors;
}
