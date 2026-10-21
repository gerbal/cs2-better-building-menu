using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One option of a facet, as the filter rail and the tool options bank draw it.
	/// </summary>
	public sealed record BuildingCatalogFacetOption(
		string Id,
		string Label,
		bool Selected) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("id", Id);
			writer.Prop("label", Label);
			writer.Prop("selected", Selected);
			writer.TypeEnd();
		}
	}

	/// <summary>
	/// One bounded categorical facet and its available options.
	/// </summary>
	/// <param name="Narrowing">
	/// Whether this group's selection actually excludes anything in view.
	/// </param>
	/// <remarks>
	/// "Every option is selected" means opposite things for a group at rest, which
	/// excludes nothing, and for a selection stranded by a menu switch, which
	/// excludes everything. The UI cannot tell them apart, so the backend says which.
	/// </remarks>
	public sealed record BuildingCatalogFacetGroup(
		string Id,
		string Label,
		BuildingCatalogFacetOption[] Options,
		bool Narrowing = false) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("id", Id);
			writer.Prop("label", Label);
			writer.Prop("narrowing", Narrowing);
			writer.Prop("options", Options);
			writer.TypeEnd();
		}
	}

	/// <summary>
	/// Binding payload for all available static facets in the current index.
	/// </summary>
	public sealed record BuildingCatalogFacetState(
		BuildingCatalogFacetGroup[] Groups,
		bool HasSelection) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("groups", Groups);
			writer.Prop("hasSelection", HasSelection);
			writer.TypeEnd();
		}
	}
}
