using Colossal.UI.Binding;

namespace FindItBuildingMenu.Domain
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
	public sealed record BuildingCatalogFacetGroup(
		string Id,
		string Label,
		BuildingCatalogFacetOption[] Options) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("label");
			writer.Write(Label);
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
