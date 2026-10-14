using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>The row Enter arms while a search is active, chosen from the whole result.</summary>
	/// <param name="Id">The prefab, armed by id whether or not its row is in the window.</param>
	/// <param name="Name">Its name.</param>
	/// <param name="Menu">The game menu it is placed from, or empty for none.</param>
	/// <param name="Index">Its place in the result's display order, from 0.</param>
	public sealed record BuildingCatalogBestMatch(int Id, string Name, string Menu, int Index) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("name");
			writer.Write(Name);
			writer.PropertyName("menu");
			writer.Write(Menu);
			writer.PropertyName("index");
			writer.Write(Index);
			writer.TypeEnd();
		}
	}
}
