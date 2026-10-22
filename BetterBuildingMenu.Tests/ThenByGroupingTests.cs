using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The second grouping the player picks beside the first: Auto keeps the first's own
	/// second level, None drops it, and a dimension splits each first-level group by its own.
	/// </summary>
	public sealed class ThenByGroupingTests
	{
		private static readonly string[] Milestones = { "", "A", "B", "", "", "", "", "", "", "Metropolis" };

		private static BuildingCatalogEntry Signature() =>
			TestEntries.Make(1, "Vesuvius Place", subCategory: "ServiceBuildings_Signatures", zoneType: ZoneTypeFilter.Signature) with
			{
				UiMenu = "Signatures",
				UiCategory = "SignaturesResidential",
				UnlockMilestone = 9,
				BuildingType = "Hospital",
				Theme = "European",
			};

		[Fact]
		public void AutoIsTheFirstChoiceUnchanged()
		{
			var entry = Signature();

			Assert.Equal(
				BuildingCatalogGrouping.Find("menuCategory").Labels(entry, Milestones).Path,
				BuildingCatalogGrouping.Find("menuCategory", "").Labels(entry, Milestones).Path);
			Assert.Equal(
				BuildingCatalogGrouping.Find("menuCategory").SecondaryKey(entry),
				BuildingCatalogGrouping.Find("menuCategory", "  ").SecondaryKey(entry));
		}

		[Fact]
		public void NoneKeepsOnlyTheFirstChoicesOuterHeadingAndItsLabelId()
		{
			var entry = Signature();
			var auto = BuildingCatalogGrouping.Find("menuCategory").Labels(entry, Milestones);
			var none = BuildingCatalogGrouping.Find("menuCategory", "none");

			Assert.Equal(new[] { auto.Path[0] }, none.Labels(entry, Milestones).Path);
			Assert.Equal(auto.LabelId, none.Labels(entry, Milestones).LabelId);
			Assert.Equal(string.Empty, none.SecondaryKey(entry));
			Assert.True(none.IsGrouped);
		}

		[Fact]
		public void ADimensionSplitsEachFirstLevelGroupByItsOwnHeadingAndKey()
		{
			var entry = Signature();
			var composed = BuildingCatalogGrouping.Find("menuCategory", "theme");

			Assert.Equal(
				new[] { BuildingCatalogGrouping.Find("menuCategory").Labels(entry, Milestones).Path[0], "European" },
				composed.Labels(entry, Milestones).Path);
			Assert.Equal(BuildingCatalogGrouping.Find("menuCategory").PrimaryKey(entry), composed.PrimaryKey(entry));
			Assert.Equal(BuildingCatalogGrouping.Find("theme").PrimaryKey(entry), composed.SecondaryKey(entry));
		}

		[Fact]
		public void AOneLevelFirstChoiceGainsASecondLevel()
		{
			var path = BuildingCatalogGrouping.Find("theme", "progression").Labels(Signature(), Milestones).Path;

			Assert.Equal(new[] { "European", "Metropolis" }, path);
		}

		[Fact]
		public void NothingGroupsWhenTheFirstChoiceIsNone()
		{
			Assert.False(BuildingCatalogGrouping.Find("none", "theme").IsGrouped);
		}

		[Fact]
		public void AutoNamesTheDimensionsItsSecondLevelUses()
		{
			var signature = Signature();
			var branch = signature with { ZoneType = ZoneTypeFilter.Any, DevTreeBranch = "Hospital" };
			var zoned = signature with { ZoneType = ZoneTypeFilter.Low };
			var transit = signature with { UiMenu = "Transportation", ZoneType = ZoneTypeFilter.Any };

			Assert.Equal(new[] { "progression" }, BuildingCatalogGrouping.AutoThenBy("menuCategory", new[] { signature, signature }));
			Assert.Equal(new[] { "density", "development", "progression" }, BuildingCatalogGrouping.AutoThenBy("menuCategory", new[] { signature, branch, zoned }));
			Assert.Equal(new[] { "role" }, BuildingCatalogGrouping.AutoThenBy("menuCategory", new[] { transit }));
			Assert.Equal(new[] { "subCategory" }, BuildingCatalogGrouping.AutoThenBy("category", new[] { signature }));
			Assert.Empty(BuildingCatalogGrouping.AutoThenBy("theme", new[] { signature }));
			Assert.Empty(BuildingCatalogGrouping.AutoThenBy("none", new[] { signature }));
		}

		[Fact]
		public void TheStateKeepsTheSecondChoiceAndDropsItWhenTheFirstTakesItOrTheMenuChanges()
		{
			var state = AssetMenuState.Initial.SetGroupBy("menuCategory").SetThenBy(" theme ");
			Assert.Equal("theme", state.Query.ThenBy);
			Assert.Same(state, state.SetThenBy("theme"));

			Assert.Equal("theme", state.SetGroupBy("role").Query.ThenBy);
			Assert.Equal(string.Empty, state.SetGroupBy("theme").Query.ThenBy);
			Assert.Equal(string.Empty, state.ResetMenu().Query.ThenBy);
		}
	}
}
