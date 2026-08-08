using Colossal.UI.Binding;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// One tab in a vanilla build menu's category strip.
	/// </summary>
	/// <remarks>
	/// Vanilla's second tier. A menu is a row of these — Transportation is Road,
	/// Train, Subway, Tram, Air and Ship — and the lens showed all 53 of that
	/// menu's members as one flat list because nothing published the tabs.
	///
	/// Id is the category prefab's name, which is exactly what
	/// BuildingCatalogEntry.UiCategory carries, so selecting a tab needs no
	/// translation layer.
	/// </remarks>
	public sealed record VanillaMenuCategory(
		string Id,
		string Name,
		string Icon,
		int Priority) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("name");
			writer.Write(Name);
			writer.PropertyName("icon");
			writer.Write(Icon);
			writer.PropertyName("priority");
			writer.Write(Priority);
			writer.TypeEnd();
		}
	}
}
