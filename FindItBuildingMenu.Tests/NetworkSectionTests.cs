using System.Linq;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
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
			// The vanilla Roads menu has no entry for net lanes and fences at
			// all, so they are reachable only through Find It. Note the
			// subcategory is offered unconditionally here while
			// LanesPrefabCategoryProcessor only indexes lanes when Extra
			// Detailing Tools is installed — without it the group is simply
			// empty, which is the right failure.
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

namespace FindItBuildingMenu.Tests
{
	public sealed class AvailabilityFilterTests
	{
		private static BuildingCatalogEntry Entry(int id, bool locked) =>
			new BuildingCatalogEntry(
				Id: id,
				PrefabName: $"P{id}",
				Name: $"P{id}",
				Category: "ServiceBuildings",
				SubCategory: "Health",
				Thumbnail: "",
				LotWidth: 2,
				LotDepth: 2,
				BuildingLevel: 1,
				ZoneType: 0,
				HasParking: false,
				IsUniqueMesh: false,
				IsVanilla: true,
				IsFavorited: false,
				PdxModsId: "",
				IsLocked: locked);

		private static readonly BuildingCatalogEntry[] Source =
		{
			Entry(1, locked: false),
			Entry(2, locked: true),
			Entry(3, locked: false),
		};

		[Fact]
		public void ShowsBothWhenNothingIsSelected()
		{
			// An untouched filter hides nothing, the same rule the zone families
			// follow.
			var page = BuildingCatalogQueryEngine.Query(Source, new BuildingCatalogQuery());

			Assert.Equal(3, page.TotalCount);
		}

		[Fact]
		public void NarrowsToWhatTheMilestonesHaveEarned()
		{
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(Availability: new[] { "Unlocked" }));

			Assert.Equal(2, page.TotalCount);
			Assert.All(page.Items, entry => Assert.False(entry.IsLocked));
		}

		[Fact]
		public void NarrowsToWhatIsStillBehindAMilestone()
		{
			// The more interesting direction: "what am I still working towards"
			// is a question the vanilla menu answers only by greying things out.
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(Availability: new[] { "Locked" }));

			Assert.Equal(1, page.TotalCount);
			Assert.True(page.Items[0].IsLocked);
		}

		[Fact]
		public void SelectingBothIsTheSameAsSelectingNeither()
		{
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(Availability: new[] { "Locked", "Unlocked" }));

			Assert.Equal(3, page.TotalCount);
		}

		[Fact]
		public void OffersEveryAvailabilityStateAsAFacet()
		{
			var facets = BuildingCatalogAdapter.BuildFacetState(Source, new BuildingCatalogQuery());
			var group = facets.Groups.Single(candidate => candidate.Id == "availability");

			// Three since AlreadyBuilt joined them. It is a state of the CITY
			// rather than of the asset, but it partitions with the other two and
			// answers the same question — can I place this — so it belongs in
			// the same dimension. See Availability.
			Assert.Equal(
				new[] { "AlreadyBuilt", "Locked", "Unlocked" },
				group.Options.Select(option => option.Id).OrderBy(id => id).ToArray());
		}

		[Fact]
		public void ClearingFiltersClearsIt()
		{
			var query = new BuildingCatalogQuery(Availability: new[] { "Locked" });

			Assert.Null(BuildingCatalogFacetSelection.Clear(query).Availability);
		}

		[Fact]
		public void TheFirstClickSelectsWhatWasClicked()
		{
			// It used to subtract — clicking Locked meant "not locked" — on the
			// argument that an empty selection shows both, so both are ticked
			// and unticking one is the honest reading. That needs the ticks to
			// be VISIBLE, and the control renders a plain two-row list with no
			// selection marks: the player clicks "Locked" to see locked assets
			// and the menu hides them instead.
			var query = BuildingCatalogFacetSelection.Toggle(
				new BuildingCatalogQuery(), "availability", "Locked");

			Assert.Equal(new[] { "Locked" }, query.Availability);
		}

		[Fact]
		public void ClickingTheSameOptionAgainGoesBackToBoth()
		{
			// Click to narrow to one, click again to return — the same gesture
			// Role and Theme answer to.
			var onlyLocked = BuildingCatalogFacetSelection.Toggle(
				new BuildingCatalogQuery(), "availability", "Locked");

			var both = BuildingCatalogFacetSelection.Toggle(onlyLocked, "availability", "Locked");

			Assert.Null(both.Availability);
		}

		[Fact]
		public void SelectingEverythingAgainCollapsesBackToAll()
		{
			// One representation of "all of them", not two that behave alike and
			// compare differently.
			var onlyUnlocked = new BuildingCatalogQuery(Availability: new[] { "Unlocked" });

			var two = BuildingCatalogFacetSelection.Toggle(onlyUnlocked, "availability", "Locked");

			// Two of three narrows nothing away yet, so it is still a selection.
			Assert.NotNull(two.Availability);

			var all = BuildingCatalogFacetSelection.Toggle(two, "availability", "AlreadyBuilt");

			// Selecting the last one covers everything, which is the same visible
			// result as selecting none — so it collapses to one stored
			// representation rather than two that compare differently.
			Assert.Null(all.Availability);
		}

		[Fact]
		public void CannotBeDrivenIntoShowingNothing()
		{
			// Deselecting the last remaining option would ask for an empty menu,
			// which no player wants and the engine reads as "show everything"
			// anyway. It returns to both.
			var onlyLocked = new BuildingCatalogQuery(Availability: new[] { "Locked" });

			var back = BuildingCatalogFacetSelection.Toggle(onlyLocked, "availability", "Locked");

			Assert.Null(back.Availability);
		}

		[Fact]
		public void IgnoresAnOptionOutsideTheKnownPair()
		{
			var query = new BuildingCatalogQuery(Availability: new[] { "Locked" });

			var same = BuildingCatalogFacetSelection.Toggle(query, "availability", "Nonsense");

			Assert.Equal(new[] { "Locked" }, same.Availability);
		}
	}
}
