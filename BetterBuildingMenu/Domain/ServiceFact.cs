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
}
