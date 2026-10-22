using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System.Linq;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The facets the UI is told about are the ones the adapter publishes, in its order.
	/// </summary>
	public sealed class BuildingCatalogFacetFieldsTests
	{
		[Fact]
		public void TheAdapterPublishesEveryFacetInTheOrderFacetIdsNames()
		{
			// A set that splits every facet, so no group is dropped for offering one value.
			var state = BuildingCatalogAdapter.BuildFacetState(FacetTableTests.Set, new BuildingCatalogQuery());

			Assert.Equal(FacetIds.All, state.Groups.Select(group => group.Id).ToArray());
		}
	}
}
