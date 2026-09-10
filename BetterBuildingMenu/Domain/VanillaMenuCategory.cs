using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One tab in a vanilla build menu's category strip.
	/// </summary>
	/// <remarks>
	/// Vanilla's second tier: a menu is a row of these. Id is the category prefab's
	/// name, which is exactly what BuildingCatalogEntry.UiCategory carries, so
	/// selecting a tab needs no translation layer.
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
