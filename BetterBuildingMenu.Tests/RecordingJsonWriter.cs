using Colossal.UI.Binding;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace BetterBuildingMenu.Tests;

/// <summary>An <see cref="IJsonWriter"/> that records each call as a token, so a test can assert the exact stream.</summary>
internal sealed class RecordingJsonWriter : IJsonWriter
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
    public void Write(float value) => Tokens.Add("Write:Single:" + value.ToString(CultureInfo.InvariantCulture));
    public void Write(double value) => Tokens.Add("Write:Double:" + value.ToString(CultureInfo.InvariantCulture));
    public void Write(string value) => Tokens.Add(value is null ? "Write:String:<null>" : "Write:String:" + value);
}
