using BetterBuildingMenu.Domain;

using Colossal.UI.Binding;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Tests;

public sealed class JsonPropExtensionsTests
{
    private static List<string> Record(Action<IJsonWriter> write)
    {
        RecordingJsonWriter writer = new();
        write(writer);
        return writer.Tokens;
    }

    [Fact]
    public void Prop_WritesTheNameThenTheValueInItsOwnType()
    {
        Assert.Equal(
            new[]
            {
                "PropertyName:s", "Write:String:text",
                "PropertyName:i", "Write:Int32:3",
                "PropertyName:b", "Write:Boolean:True",
                "PropertyName:d", "Write:Double:2.5",
            },
            Record(writer =>
            {
                writer.Prop("s", "text");
                writer.Prop("i", 3);
                writer.Prop("b", true);
                writer.Prop("d", 2.5);
            }));
    }

    [Fact]
    public void Prop_NullableNumbersWriteNullWhenMissingAndKeepTheirTypeWhenSet()
    {
        int? missingInt = null;
        double? missingDouble = null;
        int? someInt = 3;
        double? someDouble = 3;

        Assert.Equal(
            new[]
            {
                "PropertyName:a", "WriteNull",
                "PropertyName:b", "WriteNull",
                "PropertyName:c", "Write:Int32:3",
                "PropertyName:d", "Write:Double:3",
            },
            Record(writer =>
            {
                writer.Prop("a", missingInt);
                writer.Prop("b", missingDouble);
                writer.Prop("c", someInt);
                writer.Prop("d", someDouble);
            }));
    }

    [Fact]
    public void Prop_StringListWritesEveryMemberAndAMissingListAsEmpty()
    {
        string[]? missing = null;

        Assert.Equal(
            new[]
            {
                "PropertyName:some", "ArrayBegin:3", "Write:String:a", "Write:String:", "Write:String:b", "ArrayEnd",
                "PropertyName:none", "ArrayBegin:0", "ArrayEnd",
            },
            Record(writer =>
            {
                writer.Prop("some", new[] { "a", string.Empty, "b" });
                writer.Prop("none", missing);
            }));
    }

    [Fact]
    public void Prop_WritableListWritesEachMemberInOrderAndAMissingListAsEmpty()
    {
        IReadOnlyList<ZoneFootprint>? missing = null;

        Assert.Equal(
            new[]
            {
                "PropertyName:some", "ArrayBegin:2",
                "TypeBegin:" + typeof(ZoneFootprint).FullName, "PropertyName:width", "Write:Int32:1", "PropertyName:depth", "Write:Int32:2", "TypeEnd",
                "TypeBegin:" + typeof(ZoneFootprint).FullName, "PropertyName:width", "Write:Int32:3", "PropertyName:depth", "Write:Int32:4", "TypeEnd",
                "ArrayEnd",
                "PropertyName:none", "ArrayBegin:0", "ArrayEnd",
            },
            Record(writer =>
            {
                writer.Prop("some", new[] { new ZoneFootprint(1, 2), new ZoneFootprint(3, 4) });
                writer.Prop("none", missing);
            }));
    }
}
