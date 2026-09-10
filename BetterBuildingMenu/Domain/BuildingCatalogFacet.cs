using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A compact, stable option used by the Building Lens facet drawer.
	/// </summary>
	public sealed record BuildingCatalogFacetOption(
		string Id,
		string Label,
		bool Selected) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("label");
			writer.Write(Label);
			writer.PropertyName("selected");
			writer.Write(Selected);
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
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("label");
			writer.Write(Label);
			writer.PropertyName("narrowing");
			writer.Write(Narrowing);
			writer.PropertyName("options");
			writer.ArrayBegin((uint)Options.Length);
			foreach (BuildingCatalogFacetOption option in Options)
			{
				option.Write(writer);
			}
			writer.ArrayEnd();
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
			writer.PropertyName("groups");
			writer.ArrayBegin((uint)Groups.Length);
			foreach (BuildingCatalogFacetGroup group in Groups)
			{
				group.Write(writer);
			}
			writer.ArrayEnd();
			writer.PropertyName("hasSelection");
			writer.Write(HasSelection);
			writer.TypeEnd();
		}
	}
}
