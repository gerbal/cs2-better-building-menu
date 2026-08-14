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
	/// <param name="Narrowing">
	/// Whether this group's selection actually excludes anything in view.
	/// </param>
	/// <remarks>
	/// Stated here rather than inferred in the UI, which cannot tell the two
	/// all-selected cases apart:
	///
	/// - Availability at rest reports BOTH options selected, and excludes
	///   nothing. Chipping it announced "2 Active" over an unfiltered menu.
	/// - A selection stranded by a menu switch — "Require road" carried into
	///   Landscaping, where nothing has BuildingFlags — is ALSO all-selected,
	///   because the stranded value is the group's only option. It excludes
	///   everything, and suppressing its chip left a filter with no control
	///   attached and no way to clear it.
	///
	/// "Every option is selected" is true of both and means opposite things. The
	/// backend knows which is which, so it says.
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
