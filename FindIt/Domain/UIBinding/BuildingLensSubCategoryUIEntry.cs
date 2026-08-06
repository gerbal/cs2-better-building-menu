using Colossal.UI.Binding;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Utilities;

namespace FindItBuildingMenu.Domain.UIBinding;

public struct BuildingLensSubCategoryUIEntry : IJsonWritable
{
    public string Id { get; set; }
    public string Icon { get; set; }
    public string ToolTip { get; set; }

    public BuildingLensSubCategoryUIEntry(VanillaBuildMenuDescriptor descriptor)
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
