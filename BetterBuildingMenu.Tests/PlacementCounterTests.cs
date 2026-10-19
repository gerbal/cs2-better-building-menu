using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Placement;

using Game.Tools;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Which tool applies count as a placement, and how many: one per stroke, road or
	/// building, by the game's own placing tools only.
	/// </summary>
	public sealed class PlacementCounterTests
	{
		private const int RoadId = 10;
		private const int TreeId = 20;
		private const int SchoolId = 30;

		/// <summary>A tool a mod derives from the game's: it inherits "Object Tool" as its id.</summary>
		private sealed class ModObjectTool : ObjectToolSystem
		{
		}

		private static ToolSnapshot Road(bool open, int prefabId = RoadId) => new(PlacementTool.Net, PlacementKind.Chain, prefabId, open);

		/// <summary>The brush with a tree; held is the tool's Adding state, from the press to the release.</summary>
		private static ToolSnapshot Tree(bool held) => new(PlacementTool.Object, PlacementKind.Stroke, TreeId, held);

		private static readonly ToolSnapshot Erase = new(PlacementTool.Object, PlacementKind.Ignored, TreeId, false);
		private static readonly ToolSnapshot School = new(PlacementTool.Object, PlacementKind.Single, SchoolId, false);
		private static readonly ToolSnapshot District = new(PlacementTool.Area, PlacementKind.Single, 50, false);
		private static readonly ToolSnapshot Line = new(PlacementTool.Route, PlacementKind.Single, 60, false);

		/// <summary>One frame: what was armed at its start, and whether the tool applied in it.</summary>
		private readonly record struct Frame(ToolSnapshot Seen, bool Applies);

		private static Frame Hover(ToolSnapshot seen) => new(seen, false);

		private static Frame Apply(ToolSnapshot seen) => new(seen, true);

		private static IEnumerable<Frame> Times(int count, Frame frame) => Enumerable.Repeat(frame, count);

		/// <summary>
		/// One brush stroke as the game runs it: the press applies before the tool reads Adding,
		/// and the held frames after it, the release among them, read Adding.
		/// </summary>
		private static IEnumerable<Frame> Stroke(params IEnumerable<Frame>[] held) =>
			new[] { Apply(Tree(held: false)) }.Concat(held.SelectMany(run => run));

		private static IEnumerable<Frame> Held(int count, bool applies = true) => Times(count, new Frame(Tree(held: true), applies));

		/// <summary>The prefab ids the counter counted over these frames, read as PlacementWatchSystem reads them.</summary>
		private static List<int> Counted(PlacementCountRule rule, params IEnumerable<Frame>[] runs)
		{
			var counter = new PlacementCounter(rule);
			var counted = new List<int>();
			var number = 1000;

			foreach (var frame in runs.SelectMany(run => run))
			{
				// The shell reads the open state only while the counter asks for it.
				counter.Observe(number, counter.WantsOpenState ? frame.Seen : frame.Seen with { Open = false });

				if (frame.Applies && counter.Apply(number) is var id and not 0)
				{
					counted.Add(id);
				}

				number++;
			}

			return counted;
		}

		private static List<int> Counted(params IEnumerable<Frame>[] runs) => Counted(PlacementCountRule.Burst, runs);

		[Fact]
		public void OnlyTheGamesFourPlacingToolsCountAndOnlyByTheirExactType()
		{
			Assert.Equal(PlacementTool.Object, PlacementFilter.ToolOf(typeof(ObjectToolSystem)));
			Assert.Equal(PlacementTool.Net, PlacementFilter.ToolOf(typeof(NetToolSystem)));
			Assert.Equal(PlacementTool.Area, PlacementFilter.ToolOf(typeof(AreaToolSystem)));
			Assert.Equal(PlacementTool.Route, PlacementFilter.ToolOf(typeof(RouteToolSystem)));

			foreach (var other in new[] { typeof(BulldozeToolSystem), typeof(ZoneToolSystem), typeof(TerrainToolSystem), typeof(UpgradeToolSystem), typeof(DefaultToolSystem), typeof(ModObjectTool) })
			{
				Assert.Equal(PlacementTool.None, PlacementFilter.ToolOf(other));
			}

			Assert.Equal(PlacementTool.None, PlacementFilter.ToolOf(null));
		}

		[Theory]
		[InlineData(ObjectToolSystem.Mode.Create, ObjectToolSystem.State.Default, PlacementKind.Single)]
		[InlineData(ObjectToolSystem.Mode.Stamp, ObjectToolSystem.State.Default, PlacementKind.Single)]
		[InlineData(ObjectToolSystem.Mode.Line, ObjectToolSystem.State.Default, PlacementKind.Single)]
		[InlineData(ObjectToolSystem.Mode.Curve, ObjectToolSystem.State.Rotating, PlacementKind.Single)]
		[InlineData(ObjectToolSystem.Mode.Brush, ObjectToolSystem.State.Default, PlacementKind.Stroke)]
		[InlineData(ObjectToolSystem.Mode.Brush, ObjectToolSystem.State.Adding, PlacementKind.Stroke)]
		[InlineData(ObjectToolSystem.Mode.Brush, ObjectToolSystem.State.Removing, PlacementKind.Ignored)]
		[InlineData(ObjectToolSystem.Mode.Create, ObjectToolSystem.State.Removing, PlacementKind.Ignored)]
		[InlineData(ObjectToolSystem.Mode.Move, ObjectToolSystem.State.Default, PlacementKind.Ignored)]
		[InlineData(ObjectToolSystem.Mode.Upgrade, ObjectToolSystem.State.Default, PlacementKind.Ignored)]
		public void TheObjectToolCountsPlacingButNotMovingUpgradingOrErasing(ObjectToolSystem.Mode mode, ObjectToolSystem.State state, PlacementKind expected)
		{
			Assert.Equal(expected, PlacementFilter.ObjectKind(mode, state));
		}

		[Theory]
		[InlineData(NetToolSystem.Mode.Straight, PlacementKind.Chain)]
		[InlineData(NetToolSystem.Mode.SimpleCurve, PlacementKind.Chain)]
		[InlineData(NetToolSystem.Mode.ComplexCurve, PlacementKind.Chain)]
		[InlineData(NetToolSystem.Mode.Continuous, PlacementKind.Chain)]
		[InlineData(NetToolSystem.Mode.Grid, PlacementKind.Chain)]
		[InlineData(NetToolSystem.Mode.Point, PlacementKind.Chain)]
		[InlineData(NetToolSystem.Mode.Replace, PlacementKind.Single)]
		public void TheNetToolCountsACourseOnceAndAnUpgradeEachTime(NetToolSystem.Mode mode, PlacementKind expected)
		{
			Assert.Equal(expected, PlacementFilter.NetKind(mode));
		}

		[Theory]
		[InlineData(AreaToolSystem.Mode.Edit, AreaToolSystem.State.Create, PlacementKind.Single)]
		[InlineData(AreaToolSystem.Mode.Edit, AreaToolSystem.State.Default, PlacementKind.Ignored)]
		[InlineData(AreaToolSystem.Mode.Edit, AreaToolSystem.State.Modify, PlacementKind.Ignored)]
		[InlineData(AreaToolSystem.Mode.Edit, AreaToolSystem.State.Remove, PlacementKind.Ignored)]
		[InlineData(AreaToolSystem.Mode.Generate, AreaToolSystem.State.Create, PlacementKind.Ignored)]
		public void TheAreaToolCountsOnlyANewArea(AreaToolSystem.Mode mode, AreaToolSystem.State state, PlacementKind expected)
		{
			Assert.Equal(expected, PlacementFilter.AreaKind(mode, state));
		}

		[Theory]
		[InlineData(RouteToolSystem.State.Create, PlacementKind.Single)]
		[InlineData(RouteToolSystem.State.Default, PlacementKind.Ignored)]
		[InlineData(RouteToolSystem.State.Modify, PlacementKind.Ignored)]
		[InlineData(RouteToolSystem.State.Remove, PlacementKind.Ignored)]
		public void TheRouteToolCountsOnlyANewLine(RouteToolSystem.State state, PlacementKind expected)
		{
			Assert.Equal(expected, PlacementFilter.RouteKind(state));
		}

		[Fact]
		public void AFiveSegmentRoadCountsOnce()
		{
			var segment = Times(4, Hover(Road(open: true))).Append(Apply(Road(open: true))).ToArray();

			Assert.Equal(new[] { RoadId }, Counted(Times(3, Hover(Road(open: false))), Enumerable.Repeat(segment, 5).SelectMany(frames => frames)));
		}

		[Fact]
		public void ARoadEndedWithARightClickAndANewOneCountTwice()
		{
			Assert.Equal(
				new[] { RoadId, RoadId },
				Counted(
					new[] { Hover(Road(true)), Apply(Road(true)), Hover(Road(true)), Apply(Road(true)) },
					// The right-click takes the chain back to the point under the pointer.
					new[] { Hover(Road(false)), Hover(Road(false)), Hover(Road(true)), Apply(Road(true)) }));
		}

		[Fact]
		public void ArmingAnotherRoadMidChainCountsAgain()
		{
			Assert.Equal(
				new[] { RoadId, RoadId + 1 },
				Counted(new[] { Apply(Road(true)), Hover(Road(true)), Hover(Road(true, RoadId + 1)), Apply(Road(true, RoadId + 1)) }));
		}

		[Fact]
		public void ABrushStrokeCountsOnceAndASecondStrokeAgain()
		{
			Assert.Equal(new[] { TreeId, TreeId }, Counted(Stroke(Held(11)), Times(5, Hover(Tree(held: false))), Stroke(Held(7))));
		}

		[Fact]
		public void AStrokeThatCrossesASpotItCannotPlantCountsOnce()
		{
			// Held frames over a spot with an error, or off the ground, do not apply; the stroke goes on.
			Assert.Equal(new[] { TreeId }, Counted(Stroke(Held(3), Held(6, applies: false), Held(3)), Times(4, Hover(Tree(held: false)))));
		}

		[Fact]
		public void ErasingWithTheBrushCountsNothing()
		{
			Assert.Empty(Counted(Times(10, Apply(Erase))));
		}

		[Fact]
		public void EachBuildingCounts()
		{
			Assert.Equal(new[] { SchoolId, SchoolId }, Counted(new[] { Apply(School) }, Times(10, Hover(School)), new[] { Apply(School) }));
		}

		[Fact]
		public void AnApplyTheGameRepeatsAfterAFocusChangeCountsOnce()
		{
			// Alt-tab mid-placement: the net and area tools skip their update, and their last Apply
			// goes out again on the next frame.
			Assert.Equal(new[] { RoadId }, Counted(new[] { Apply(Road(true)), Apply(Road(true)) }));
			Assert.Equal(new[] { 50 }, Counted(new[] { Apply(District), Apply(District) }));
		}

		[Fact]
		public void ADistrictAndATransitLineCountOnceEach()
		{
			Assert.Equal(new[] { 50, 60 }, Counted(new[] { Apply(District), Hover(ToolSnapshot.None), Apply(Line) }));
		}

		[Fact]
		public void MovingUpgradingBulldozingZoningAndOtherModsToolsCountNothing()
		{
			var move = new ToolSnapshot(PlacementTool.Object, PlacementKind.Ignored, 0, false);
			var upgrade = new ToolSnapshot(PlacementTool.Object, PlacementKind.Ignored, 40, false);

			Assert.Empty(Counted(new[] { Apply(move), Hover(move), Apply(upgrade), Hover(upgrade), Apply(ToolSnapshot.None) }));
		}

		[Fact]
		public void AnApplyWithNoSnapshotThatFrameCountsNothing()
		{
			var counter = new PlacementCounter(PlacementCountRule.Burst);
			counter.Observe(1, School);

			Assert.Equal(0, counter.Apply(2));
		}

		[Fact]
		public void ALoadEndsAnOpenRoad()
		{
			var counter = new PlacementCounter(PlacementCountRule.Burst);
			counter.Observe(1, Road(true));
			Assert.Equal(RoadId, counter.Apply(1));

			counter.Reset();
			counter.Observe(500, Road(true));

			Assert.Equal(RoadId, counter.Apply(500));
		}

		[Fact]
		public void PerArmCountsAPrefabOnceUntilItIsArmedAgain()
		{
			Assert.Equal(
				new[] { SchoolId, SchoolId, RoadId },
				Counted(
					PlacementCountRule.PerArm,
					new[] { Apply(School), Hover(School), Apply(School) },
					new[] { Hover(ToolSnapshot.None), Apply(School) },
					new[] { Apply(Road(false)), Hover(Road(false)), Apply(Road(false)) }));
		}

		[Fact]
		public void PerArmCountsTwoStrokesOnce()
		{
			Assert.Equal(new[] { TreeId }, Counted(PlacementCountRule.PerArm, Stroke(Held(3)), Times(5, Hover(Tree(held: false))), Stroke(Held(3))));
		}

		[Fact]
		public void TheKeyIsTheIndexedPrefabsOwnMenuAndName()
		{
			var road = TestPrefabs.Named(7, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			road.UiMenuName = " Roads ";
			var unfiled = TestPrefabs.Named(8, "Prop", PrefabCategory.Props, PrefabSubCategory.Props_Misc);
			var index = TestPrefabs.ReadyIndex(road, unfiled);

			Assert.Equal(new PlacementKey("Roads", "Small Road"), PlacementMenuKey.Resolve(index, 7));
			Assert.Null(PlacementMenuKey.Resolve(index, 8));
			Assert.Null(PlacementMenuKey.Resolve(index, 9));
		}

		[Fact]
		public void NothingResolvesWhileTheIndexIsBeingRebuilt()
		{
			var road = TestPrefabs.Named(7, "Small Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			road.UiMenuName = "Roads";
			var index = TestPrefabs.ReadyIndex(road);
			index.IsReady = false;

			Assert.Null(PlacementMenuKey.Resolve(index, 7));
		}
	}
}
