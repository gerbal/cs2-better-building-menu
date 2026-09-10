using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One service figure beyond the building's headline capacity.
	/// </summary>
	/// <remarks>
	/// A keyed list rather than a field each: these figures are meaningful to one
	/// service and absent from every other, so a field apiece would add always-null
	/// columns to every entry. The key is an identifier; the UI owns the wording.
	/// </remarks>
	public readonly record struct ServiceFact(string Key, double Value) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("key");
			writer.Write(Key ?? string.Empty);
			writer.PropertyName("value");
			writer.Write(Value);
			writer.TypeEnd();
		}
	}

	/// <summary>
	/// The same idea for a figure that is a word rather than a number.
	/// </summary>
	/// <remarks>
	/// A zone's traded resources and its narrow and corner support are facts of this
	/// shape, but none of them is a quantity. A separate record rather than a
	/// nullable text on ServiceFact, so a numeric fact cannot be written with no number.
	/// </remarks>
	public readonly record struct ServiceTextFact(string Key, string Value) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("key");
			writer.Write(Key ?? string.Empty);
			writer.PropertyName("value");
			writer.Write(Value ?? string.Empty);
			writer.TypeEnd();
		}
	}
}
