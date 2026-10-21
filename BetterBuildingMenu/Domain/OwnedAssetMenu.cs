using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A toolbar menu the asset menu stands in for: its prefab entity index, which is what the
	/// game's toolbar.selectedAssetMenu binding carries, and its prefab name.
	/// </summary>
	/// <remarks>See MenuRouting.OwnedMenus and docs/design-notes.md, "Opening a menu".</remarks>
	public sealed record OwnedAssetMenu(int Index, string Name) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("index", Index);
			writer.Prop("name", Name);
			writer.TypeEnd();
		}
	}
}
