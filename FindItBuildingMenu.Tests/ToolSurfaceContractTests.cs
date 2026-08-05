using Colossal.UI.Binding;
using FindItBuildingMenu.Domain;

namespace FindItBuildingMenu.Tests;

public sealed class ToolSurfaceContractTests
{
    [Fact]
    public void Catalog_PreservesStableSurfaceOrderAndIdentifiers()
    {
        ToolSurfaceDescriptor[] descriptors = ToolSurfaceCatalog.GetDescriptors().ToArray();

        Assert.Equal(
            new[]
            {
                ToolSurfaceIds.Roads,
                ToolSurfaceIds.Paths,
                ToolSurfaceIds.LotTerraform,
                ToolSurfaceIds.Vegetation,
                ToolSurfaceIds.Props,
                ToolSurfaceIds.Vehicles,
            },
            descriptors.Select(descriptor => descriptor.Id).ToArray());
        Assert.Equal(descriptors.Length, descriptors.Select(descriptor => descriptor.Id).Distinct(StringComparer.Ordinal).Count());
        Assert.All(descriptors, descriptor =>
        {
            Assert.False(string.IsNullOrWhiteSpace(descriptor.Icon));
            Assert.False(string.IsNullOrWhiteSpace(descriptor.ToolTip));
            Assert.False(string.IsNullOrWhiteSpace(descriptor.Action));
            Assert.NotEmpty(descriptor.Aliases);
            Assert.All(descriptor.Aliases, alias => Assert.False(int.TryParse(alias, out _)));
        });
    }

    [Fact]
    public void DescriptorWrite_UsesFlatPrimitivePayload()
    {
        ToolSurfaceDescriptor descriptor = ToolSurfaceCatalog.GetDescriptors().Single(item => item.Id == ToolSurfaceIds.Roads);
        RecordingJsonWriter writer = new();

        descriptor.Write(writer);

        Assert.Equal(
            new[] { "id", "icon", "toolTip", "action", "aliases" },
            writer.PropertyNames);
        Assert.Contains("ArrayBegin:3", writer.Tokens);
        Assert.Contains("Write:String:Roads", writer.Tokens);
    }

    [Fact]
    public void Catalog_UsesVanillaMenuAndCategoryMappings()
    {
        ToolSurfaceDescriptor[] descriptors = ToolSurfaceCatalog.GetDescriptors().ToArray();

        Assert.Equal(ToolSurfaceActions.NativeAssetCategory, descriptors.Single(item => item.Id == ToolSurfaceIds.Paths).Action);
        Assert.Contains("Pathways", descriptors.Single(item => item.Id == ToolSurfaceIds.Paths).Aliases);

        Assert.Equal(ToolSurfaceActions.NativeAssetCategory, descriptors.Single(item => item.Id == ToolSurfaceIds.LotTerraform).Action);
        Assert.Contains("Terraforming", descriptors.Single(item => item.Id == ToolSurfaceIds.LotTerraform).Aliases);

        Assert.Equal(ToolSurfaceActions.NativeAssetCategory, descriptors.Single(item => item.Id == ToolSurfaceIds.Vegetation).Action);
        Assert.Contains("Vegetation", descriptors.Single(item => item.Id == ToolSurfaceIds.Vegetation).Aliases);

        Assert.Equal(ToolSurfaceActions.NativeAssetMenu, descriptors.Single(item => item.Id == ToolSurfaceIds.Props).Action);
        Assert.Contains("Landscaping", descriptors.Single(item => item.Id == ToolSurfaceIds.Props).Aliases);
        Assert.Equal(ToolSurfaceActions.NativeAssetMenu, descriptors.Single(item => item.Id == ToolSurfaceIds.Vehicles).Action);
        Assert.Contains("Transportation", descriptors.Single(item => item.Id == ToolSurfaceIds.Vehicles).Aliases);
    }

    private sealed class RecordingJsonWriter : IJsonWriter
    {
        public List<string> Tokens { get; } = new();

        public IReadOnlyList<string> PropertyNames => Tokens
            .Where(token => token.StartsWith("PropertyName:", StringComparison.Ordinal))
            .Select(token => token["PropertyName:".Length..])
            .ToArray();

        public string debugName => nameof(RecordingJsonWriter);

        public void TypeBegin(string typeName) => Tokens.Add("TypeBegin:" + typeName);
        public void TypeEnd() => Tokens.Add("TypeEnd");
        public void MapBegin(uint size) => Tokens.Add("MapBegin:" + size);
        public void MapEnd() => Tokens.Add("MapEnd");
        public void ArrayBegin(uint size) => Tokens.Add("ArrayBegin:" + size);
        public void ArrayEnd() => Tokens.Add("ArrayEnd");
        public void PropertyName(string name) => Tokens.Add("PropertyName:" + name);
        public void WriteNull() => Tokens.Add("WriteNull");
        public void Write(bool value) => Tokens.Add("Write:Boolean:" + value);
        public void Write(int value) => Tokens.Add("Write:Int32:" + value);
        public void Write(uint value) => Tokens.Add("Write:UInt32:" + value);
        public void Write(long value) => Tokens.Add("Write:Int64:" + value);
        public void Write(ulong value) => Tokens.Add("Write:UInt64:" + value);
        public void Write(float value) => Tokens.Add("Write:Single:" + value);
        public void Write(double value) => Tokens.Add("Write:Double:" + value);
        public void Write(string value) => Tokens.Add("Write:String:" + value);
    }
}
