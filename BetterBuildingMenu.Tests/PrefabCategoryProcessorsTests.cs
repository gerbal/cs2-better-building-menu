using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Utilities.PrefabCategoryProcessor;

using Game.Prefabs;

using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;

using Unity.Entities;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The processors an index pass runs, and the report of prefabs two of them claimed.
	/// </summary>
	public sealed class PrefabCategoryProcessorsTests
	{
		private static List<System.Type> Listed() =>
			PrefabCategoryProcessors.InRunOrder.Select(entry => entry.Type).ToList();

		[Fact]
		public void ListsEveryProcessorInTheAssemblyOnce()
		{
			// The list replaced discovery by reflection. A processor written and
			// left off it would index nothing, silently.
			var defined = typeof(IPrefabCategoryProcessor).Assembly.GetTypes()
				.Where(type => typeof(IPrefabCategoryProcessor).IsAssignableFrom(type) && !type.IsAbstract && !type.IsInterface)
				.Select(type => type.FullName)
				.OrderBy(name => name)
				.ToList();

			var listed = Listed().Select(type => type.FullName).ToList();

			Assert.Equal(listed.Count, listed.Distinct().Count());
			Assert.Equal(defined, listed.OrderBy(name => name).ToList());
		}

		[Fact]
		public void RunsTheMenuPlacedCatchAllLast()
		{
			// It claims only what nothing else did, so anything after it could take
			// a prefab it had already given a placeholder category.
			Assert.Equal(typeof(MenuPlacedPrefabCategoryProcessor), Listed().Last());
		}

		[Fact]
		public void ReportsNothingWhenNoPrefabIsClaimedTwice()
		{
			var claims = new Dictionary<string, List<int>>
			{
				["Roads"] = new() { 1, 2 },
				["Props"] = new() { 3 },
			};

			Assert.Empty(ProcessorOverlap.Find(new[] { "Roads", "Props" }, claims));
		}

		[Fact]
		public void NamesThePairOnceWithHowManyPrefabsItShared()
		{
			var claims = new Dictionary<string, List<int>>
			{
				["Props"] = new() { 1, 2, 3 },
				["SportProps"] = new() { 2, 3, 4 },
			};

			var pair = Assert.Single(ProcessorOverlap.Find(new[] { "Props", "SportProps" }, claims));

			Assert.Equal(new ProcessorOverlap.Pair("Props", "SportProps", 2, 2), pair);
		}

		[Fact]
		public void TakesEarlierAndLaterFromTheRunOrder()
		{
			// The census is a dictionary with no order of its own; only the order
			// the pass ran the processors says whose entry stands.
			var claims = new Dictionary<string, List<int>>
			{
				["SportProps"] = new() { 7 },
				["Props"] = new() { 7 },
			};

			var pair = Assert.Single(ProcessorOverlap.Find(new[] { "Props", "SportProps" }, claims));

			Assert.Equal(("Props", "SportProps"), (pair.Earlier, pair.Later));
		}

		[Fact]
		public void FollowsAPrefabThroughEachProcessorThatReplacedIt()
		{
			var claims = new Dictionary<string, List<int>>
			{
				["A"] = new() { 9 },
				["B"] = new() { 9 },
				["C"] = new() { 9 },
			};

			var pairs = ProcessorOverlap.Find(new[] { "A", "B", "C", "Unused" }, claims)
				.Select(pair => (pair.Earlier, pair.Later))
				.ToList();

			Assert.Equal(new[] { ("A", "B"), ("B", "C") }, pairs);
		}

		/// <summary>Every processor, built as an index pass builds them, over a default EntityManager.</summary>
		/// <remarks>The answers below are the ones a processor gives before it reads the entity or the
		/// prefab's name, which only the game can answer.</remarks>
		private static readonly IPrefabCategoryProcessor[] Built =
			PrefabCategoryProcessors.Create(new PrefabCategoryProcessors.Dependencies(default, null!, null!));

		/// <summary>A prefab of this type carrying these components.</summary>
		/// <remarks>Uninitialized, because a prefab is a Unity ScriptableObject, which only the engine can create.</remarks>
		private static PrefabBase Prefab(System.Type type, params System.Type[] components)
		{
			var prefab = (PrefabBase)RuntimeHelpers.GetUninitializedObject(type);
			prefab.components = components.Select(component => (ComponentBase)RuntimeHelpers.GetUninitializedObject(component)).ToList();
			return prefab;
		}

		/// <summary>Where the processor files the prefab, or null when it skips it and leaves no entry.</summary>
		private static (PrefabCategory, PrefabSubCategory)? Answer(System.Type processor, PrefabBase prefab, CatalogIndex? target = null)
		{
			var claimed = Built.Single(built => built.GetType() == processor)
				.TryCreatePrefabIndex(prefab, new Entity { Index = 7, Version = 1 }, target ?? new CatalogIndex(), out var entry);

			if (!claimed)
			{
				Assert.Null(entry);
				return null;
			}

			return (entry!.Category, entry.SubCategory);
		}

		[Theory]
		// Not Bridges: it reads the prefab's name to tell a pier, which only the game can answer.
		// BridgeNetsTests holds its split.
		[InlineData(typeof(FencePrefabCategoryProcessor), typeof(FencePrefab), PrefabCategory.Props, PrefabSubCategory.Props_Fences)]
		[InlineData(typeof(IntersectionsPrefabCategoryProcessor), typeof(AssetStampPrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Intersections)]
		[InlineData(typeof(PathsPrefabCategoryProcessor), typeof(PathwayPrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Paths)]
		[InlineData(typeof(PillarPrefabCategoryProcessor), typeof(StaticObjectPrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Pillars)]
		[InlineData(typeof(RoadsPrefabCategoryProcessor), typeof(RoadPrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Roads)]
		[InlineData(typeof(ServiceBuildingPrefabCategoryProcessor), typeof(BuildingPrefab), PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Misc)]
		[InlineData(typeof(ServiceBuildingPrefabCategoryProcessor), typeof(BuildingExtensionPrefab), PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Misc)]
		[InlineData(typeof(SurfacePrefabCategoryProcessor), typeof(SurfacePrefab), PrefabCategory.Props, PrefabSubCategory.Props_Surfaces)]
		[InlineData(typeof(SurfacePrefabCategoryProcessor), typeof(AreaPrefab), PrefabCategory.Props, PrefabSubCategory.Props_Surfaces)]
		[InlineData(typeof(TerraformingPrefabCategoryProcessor), typeof(TerraformingPrefab), PrefabCategory.Props, PrefabSubCategory.Props_Misc)]
		[InlineData(typeof(TracksPrefabCategoryProcessor), typeof(TrackPrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Tracks)]
		[InlineData(typeof(TransportLinePrefabCategoryProcessor), typeof(TransportLinePrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Routes)]
		[InlineData(typeof(UtilityNetworksPrefabCategoryProcessor), typeof(PowerLinePrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_PowerLines)]
		[InlineData(typeof(UtilityNetworksPrefabCategoryProcessor), typeof(PipelinePrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Pipes)]
		[InlineData(typeof(WaterwaysPrefabCategoryProcessor), typeof(WaterwayPrefab), PrefabCategory.Networks, PrefabSubCategory.Networks_Waterways)]
		public void FilesAPrefabItAcceptsUnderItsCategory(System.Type processor, System.Type prefab, PrefabCategory category, PrefabSubCategory subCategory)
		{
			Assert.Equal((category, subCategory), Answer(processor, Prefab(prefab)));
		}

		[Theory]
		[InlineData(typeof(BridgesPrefabCategoryProcessor), typeof(StaticObjectPrefab))]
		[InlineData(typeof(BridgesPrefabCategoryProcessor), typeof(BuildingPrefab))]
		[InlineData(typeof(DecalsPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(FencePrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(LanesPrefabCategoryProcessor), typeof(NetLaneGeometryPrefab))]
		[InlineData(typeof(MenuPlacedPrefabCategoryProcessor), typeof(UIAssetCategoryPrefab))]
		[InlineData(typeof(MiscBuildingPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(PathsPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(RoadsPrefabCategoryProcessor), typeof(PathwayPrefab))]
		[InlineData(typeof(ServiceBuildingPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(SportPropPrefabCategoryProcessor), typeof(BuildingPrefab))]
		[InlineData(typeof(TerraformingPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(TracksPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(TransportLinePrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(UtilityNetworksPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(WaterwaysPrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(ZonePrefabCategoryProcessor), typeof(RoadPrefab))]
		[InlineData(typeof(ZonedBuildingPrefabCategoryProcessor), typeof(BuildingExtensionPrefab))]
		public void SkipsAPrefabItDoesNotAccept(System.Type processor, System.Type prefab)
		{
			// Lanes skips here because the index's mods leave out Extra Detailing; a
			// menu category's tab is never an asset.
			Assert.Null(Answer(processor, Prefab(prefab)));
		}

		[Fact]
		public void FilesAHighwayUnderHighways()
		{
			var highway = (RoadPrefab)Prefab(typeof(RoadPrefab));
			highway.m_HighwayRules = true;

			Assert.Equal((PrefabCategory.Networks, PrefabSubCategory.Networks_Highways), Answer(typeof(RoadsPrefabCategoryProcessor), highway));
		}

		[Fact]
		public void FilesAFenceThatUpgradesARoadUnderNetworkUpgrades()
		{
			Assert.Equal(
				(PrefabCategory.Networks, PrefabSubCategory.Networks_Upgrades),
				Answer(typeof(FencePrefabCategoryProcessor), Prefab(typeof(FencePrefab), typeof(NetUpgrade))));
		}

		[Fact]
		public void FilesAResourceBrushOnlyWhereTheVanillaMenuPlacesIt()
		{
			var brush = (TerraformingPrefab)Prefab(typeof(TerraformingPrefab));
			brush.m_Target = TerraformingTarget.Ore;

			var menus = new VanillaMenuIndex(
				new Dictionary<int, VanillaMenuPlacement> { [7] = new(new Entity { Index = 7, Version = 1 }, "Areas", "Resources", CategoryPriority: 0) },
				new Dictionary<int, string>(),
				new Dictionary<string, Entity>(),
				System.Array.Empty<VanillaMenuCategory>(),
				new Dictionary<string, List<VanillaMenuCategory>>());

			Assert.Null(Answer(typeof(TerraformingPrefabCategoryProcessor), brush));
			Assert.Equal((PrefabCategory.Props, PrefabSubCategory.Props_Misc), Answer(typeof(TerraformingPrefabCategoryProcessor), brush, new CatalogIndex(menus)));
		}

		[Fact]
		public void WithExtraDetailingSkipsAPrefabThatIsNotALane()
		{
			var index = new CatalogIndex(mods: new ModCompatibility(ExtraDetailing: true, RoadBuilder: false));

			Assert.Null(Answer(typeof(LanesPrefabCategoryProcessor), Prefab(typeof(RoadPrefab)), index));
		}
	}
}
