using Colossal.UI.Binding;
using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// One assignable zone, as the zoning hierarchy presents it.
	/// </summary>
	/// <remarks>
	/// Family and density both come from the zone's own data rather than its
	/// name: <c>ZoneData.m_AreaType</c> plus <c>ZoneFlags.Office</c> for the
	/// family, and the <c>ZonePropertiesData</c> derivation IndexZones already
	/// performs for the density.
	///
	/// <c>Id</c> and <c>Version</c> are the ECS entity's two halves. They are
	/// runtime values and must not be persisted; the UI needs both to hand the
	/// entity back to the game's own toolbar.selectAsset trigger, which is what
	/// actually activates the Zone tool.
	/// </remarks>
	public sealed record ZoneCatalogEntry(
		int Id,
		int Version,
		string PrefabName,
		string Name,
		string Family,
		ZoneTypeFilter Density,
		string Thumbnail) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("version");
			writer.Write(Version);
			writer.PropertyName("prefabName");
			writer.Write(PrefabName);
			writer.PropertyName("name");
			writer.Write(Name);
			writer.PropertyName("family");
			writer.Write(Family);
			writer.PropertyName("density");
			writer.Write(Density.ToString());
			writer.PropertyName("thumbnail");
			writer.Write(Thumbnail);
			writer.TypeEnd();
		}
	}
}
