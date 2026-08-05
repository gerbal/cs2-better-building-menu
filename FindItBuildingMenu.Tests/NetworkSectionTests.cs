using System.Linq;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class NetworkSectionTests
	{
		[Fact]
		public void OffersNetworksAsASectionOfItsOwn()
		{
			Assert.Contains(
				VanillaBuildMenuTaxonomy.GetSectionDescriptors(),
				descriptor => descriptor.Id == VanillaBuildMenuTaxonomy.Networks);
		}

		[Fact]
		public void FilesEveryNetworkSubcategoryUnderIt()
		{
			var ids = VanillaBuildMenuTaxonomy
				.GetSubcategoryDescriptors(VanillaBuildMenuTaxonomy.Networks)
				.Select(descriptor => descriptor.Id)
				.ToArray();

			Assert.Contains(PrefabSubCategory.Networks_Roads.ToString(), ids);
			Assert.Contains(PrefabSubCategory.Networks_Highways.ToString(), ids);
			Assert.Contains(PrefabSubCategory.Networks_Paths.ToString(), ids);
			Assert.Contains(PrefabSubCategory.Networks_Pillars.ToString(), ids);
		}

		[Fact]
		public void IncludesLanes()
		{
			// The reason the section is worth having. The vanilla Roads menu has
			// no entry for net lanes and fences at all, so they are reachable
			// only through Find It.
			var ids = VanillaBuildMenuTaxonomy
				.GetSubcategoryDescriptors(VanillaBuildMenuTaxonomy.Networks)
				.Select(descriptor => descriptor.Id);

			Assert.Contains(PrefabSubCategory.Networks_Lanes.ToString(), ids);
		}

		[Fact]
		public void TagsANetworkPrefabWithTheNetworksSection()
		{
			var tag = VanillaBuildMenuTaxonomy.Resolve(
				PrefabCategory.Networks,
				PrefabSubCategory.Networks_Lanes,
				ZoneTypeFilter.Any);

			Assert.NotNull(tag);
			Assert.Equal(VanillaBuildMenuTaxonomy.Networks, tag!.Section);
			Assert.Equal(PrefabSubCategory.Networks_Lanes.ToString(), tag.SubCategory);
		}

		[Fact]
		public void LeavesBuildingTaggingAlone()
		{
			// Networks joining the catalog must not reclassify anything that was
			// already in it.
			var service = VanillaBuildMenuTaxonomy.Resolve(
				PrefabCategory.ServiceBuildings,
				PrefabSubCategory.ServiceBuildings_Health,
				ZoneTypeFilter.Any);

			Assert.Equal(VanillaBuildMenuTaxonomy.ServiceBuildings, service!.Section);

			var signature = VanillaBuildMenuTaxonomy.Resolve(
				PrefabCategory.Buildings,
				PrefabSubCategory.Buildings_Commercial,
				ZoneTypeFilter.Signature);

			Assert.Equal(VanillaBuildMenuTaxonomy.SignatureBuildings, signature!.Section);
		}

		[Fact]
		public void DeclinesANetworkSubcategoryThatIsNotOne()
		{
			// A service building filed under the Networks category would be a
			// data error, not a network; tagging it as one would hide it from
			// the section it belongs to.
			var tag = VanillaBuildMenuTaxonomy.Resolve(
				PrefabCategory.Networks,
				PrefabSubCategory.ServiceBuildings_Health,
				ZoneTypeFilter.Any);

			Assert.Null(tag);
		}

		[Fact]
		public void RoutesTheVanillaRoadsMenuToNetworks()
		{
			var preset = VanillaMenuPresets.Resolve("Roads");

			Assert.NotNull(preset);
			Assert.Equal(PrefabCategory.Networks, preset!.Category);
			Assert.Equal(PrefabSubCategory.Any, preset.SubCategory);
			Assert.False(preset.IsZoning);
		}

		[Fact]
		public void StillDeclinesLandscapingAndAreas()
		{
			// Terrain tooling more than a catalogue. Declining leaves the vanilla
			// menu working rather than opening the lens on something unrelated.
			Assert.Null(VanillaMenuPresets.Resolve("Landscaping"));
			Assert.Null(VanillaMenuPresets.Resolve("Areas"));
			Assert.Null(VanillaMenuPresets.Resolve("Some Modded Menu"));
		}
	}
}
