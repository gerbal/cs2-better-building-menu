using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One service figure beyond the building's headline capacity.
	/// </summary>
	/// <remarks>
	/// A keyed list rather than a field each. The catalog already carries a
	/// field per universal metric — cost, upkeep, workers, the pollutions — and
	/// that shape is right for values every asset can have. These are not
	/// those: a hospital's helicopters, a garbage plant's processing speed and a
	/// water station's purification are each meaningful to ONE service and null
	/// for the other twenty, so a field apiece would add twenty always-null
	/// columns to every entry in the catalog to serve one of them.
	///
	/// The key is a stable identifier, not a label. The UI maps it to a
	/// localized string and a unit, so the backend never decides wording and a
	/// new figure costs an indexer line and a table entry rather than a field
	/// on the record, a JSON property, a formatter and a tooltip candidate.
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
	/// A zone's traded resources and its narrow and corner support are facts of
	/// exactly this shape — one family of asset, absent from every other — but
	/// none of them is a quantity. They had no delivery path at all: the UI's
	/// getZoneFacts covered them, was tested, and had no caller, because
	/// nothing ever produced the entry shape it read.
	///
	/// A separate record rather than a nullable text on ServiceFact, so a
	/// numeric fact cannot be written with no number and the UI never has to
	/// ask which kind it is holding.
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
