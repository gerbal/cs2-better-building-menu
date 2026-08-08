using Colossal.UI.Binding;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Utilities;

namespace FindItBuildingMenu.Domain.UIBinding;

/// <summary>
/// One tab in the Building Lens role strip. Shaped identically to
/// <see cref="BuildingLensSubCategoryUIEntry"/> — Id/Icon/ToolTip — so the UI
/// renders it with the same code that already draws the subcategory tabs
/// rather than a second tab renderer.
/// </summary>
public struct BuildingLensRoleUIEntry : IJsonWritable
{
    public string Id { get; set; }
    public string Icon { get; set; }
    public string ToolTip { get; set; }

    public BuildingLensRoleUIEntry(VanillaBuildMenuDescriptor descriptor)
    {
        Id = descriptor.Id;
        Icon = descriptor.Icon;
        ToolTip = LocaleHelper.TranslateLabel(descriptor.Tooltip, descriptor.Tooltip);
    }

    public readonly void Write(IJsonWriter writer)
    {
        writer.TypeBegin(GetType().FullName);
        writer.PropertyName("id");
        writer.Write(Id);
        writer.PropertyName("icon");
        writer.Write(Icon);
        writer.PropertyName("toolTip");
        writer.Write(ToolTip);
        writer.TypeEnd();
    }
}
