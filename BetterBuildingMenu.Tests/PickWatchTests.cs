using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Placement;

using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The pick logger between frames: an arm lasts while its tool stays in hand, BBM's note marks
	/// the arm it asks for, and the watcher reads the knob and keeps the logger's failures apart.
	/// </summary>
	public sealed class PickWatchTests
	{
		private const int DistrictId = 50;
		private const int ParkId = 51;
		private const int LineId = 60;
		private const int SmallRoadId = 10;
		private const int MediumRoadId = 11;

		private static readonly CatalogIndex Index = TestPrefabs.ReadyIndex(
			Filed(DistrictId, "Areas", "District"),
			Filed(ParkId, "Areas", "Park"),
			Filed(LineId, "Transportation", "Bus Line"),
			Filed(SmallRoadId, "Roads", "Small Road"),
			Filed(MediumRoadId, "Roads", "Medium Road"));

		private static readonly CameraPose Still = new(100, 50, 200, 0, -0.6f, 0.8f);

		private static PrefabIndex Filed(int id, string menu, string prefab)
		{
			var entry = TestPrefabs.Named(id, prefab, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Misc);
			entry.UiMenuName = menu;

			return entry;
		}

		/// <summary>A watch fed frame by frame and placement by placement, keeping every line it gives.</summary>
		private sealed class Session
		{
			private double _seconds;

			public PickWatch Watch { get; } = new();

			public List<PickEvent> Lines { get; } = new();

			public IEnumerable<PickArm> Arms => Lines.OfType<PickArm>();

			public IEnumerable<int> SinceArm => Lines.OfType<PickPlace>().Select(place => place.SinceArm);

			public Session Frame(PlacementTool tool, int prefabId, CameraPose? camera = null)
			{
				Lines.AddRange(Watch.Frame(++_seconds, tool, prefabId, camera ?? Still, Index));

				return this;
			}

			/// <summary>Frames in which the tool in hand reads as nothing armed, as the area and route tools do between placements.</summary>
			public Session Idle(PlacementTool tool) => Frame(tool, 0).Frame(tool, 0).Frame(tool, 0);

			public Session Place(int prefabId)
			{
				Lines.Add(Watch.Placed(++_seconds, PlacementMenuKey.Resolve(Index, prefabId)!.Value, new ScreenPoint(960, 540), BoxState.Open));

				return this;
			}

			public Session Note(int prefabId)
			{
				Watch.NoteBbmArm(prefabId);

				return this;
			}
		}

		[Theory]
		[InlineData(PlacementTool.Area, DistrictId)]
		[InlineData(PlacementTool.Route, LineId)]
		public void TheToolIdleBetweenTwoPlacementsKeepsOneArm(PlacementTool tool, int prefabId)
		{
			var session = new Session()
				.Idle(tool).Frame(tool, prefabId).Place(prefabId)
				.Idle(tool).Frame(tool, prefabId).Place(prefabId);

			Assert.Single(session.Arms);
			Assert.Equal(new[] { 1, 2 }, session.SinceArm);
		}

		[Fact]
		public void PuttingTheToolDownEndsTheArm()
		{
			var session = new Session()
				.Frame(PlacementTool.Area, DistrictId).Place(DistrictId)
				.Frame(PlacementTool.None, 0)
				.Idle(PlacementTool.Area).Frame(PlacementTool.Area, DistrictId).Place(DistrictId);

			Assert.Equal(new[] { "District", "District" }, session.Arms.Select(arm => arm.Prefab));
			Assert.Equal(new[] { 1, 1 }, session.SinceArm);
		}

		[Fact]
		public void AnotherToolEndsTheArmSoTheNextIsNoSwap()
		{
			var session = new Session()
				.Frame(PlacementTool.Area, DistrictId).Place(DistrictId)
				.Frame(PlacementTool.Net, SmallRoadId)
				.Idle(PlacementTool.Area).Frame(PlacementTool.Area, DistrictId).Place(DistrictId);

			Assert.Equal(new[] { "District", "Small Road", "District" }, session.Arms.Select(arm => arm.Prefab));
			Assert.Empty(session.Lines.OfType<PickSwap>());
			Assert.Equal(new[] { 1, 1 }, session.SinceArm);
		}

		[Fact]
		public void AnotherBuildingInTheSameToolIsASwap()
		{
			var session = new Session().Frame(PlacementTool.Net, SmallRoadId).Frame(PlacementTool.Net, MediumRoadId);

			Assert.Equal(new[] { new PickSwap(2, "Roads", "Medium Road", "Small Road") }, session.Lines.OfType<PickSwap>());
		}

		[Fact]
		public void BbmsNoteComesWithTheToolItPutsInHand()
		{
			// BBM's arm puts the area tool in hand at once; the district shows only once it is drawn.
			var session = new Session()
				.Frame(PlacementTool.None, 0)
				.Note(DistrictId).Idle(PlacementTool.Area).Frame(PlacementTool.Area, DistrictId);

			Assert.Equal(new[] { PickSource.Bbm }, session.Arms.Select(arm => arm.Source));
		}

		[Fact]
		public void BbmsNoteOutlastsTheIdleFramesBetweenPlacements()
		{
			var session = new Session()
				.Frame(PlacementTool.Area, DistrictId).Place(DistrictId)
				.Note(ParkId).Idle(PlacementTool.Area).Frame(PlacementTool.Area, ParkId);

			Assert.Equal(new[] { PickSource.Game, PickSource.Bbm }, session.Arms.Select(arm => arm.Source));
		}

		[Fact]
		public void BbmsNoteEndsWithTheToolItArmed()
		{
			var session = new Session()
				.Frame(PlacementTool.None, 0)
				.Note(DistrictId).Idle(PlacementTool.Area)
				.Frame(PlacementTool.None, 0)
				.Idle(PlacementTool.Area).Frame(PlacementTool.Area, DistrictId);

			Assert.Equal(new[] { PickSource.Game }, session.Arms.Select(arm => arm.Source));
		}

		[Fact]
		public void OnlyTheArmAfterBbmsNoteIsBbms()
		{
			var session = new Session()
				.Note(SmallRoadId).Frame(PlacementTool.Net, SmallRoadId).Place(SmallRoadId)
				.Frame(PlacementTool.Net, MediumRoadId).Place(MediumRoadId)
				.Frame(PlacementTool.Net, SmallRoadId);

			Assert.Equal(new[] { PickSource.Bbm, PickSource.Game, PickSource.Game }, session.Arms.Select(arm => arm.Source));
		}

		[Fact]
		public void AResetForgetsBbmsNoteAndWhatIsArmed()
		{
			var session = new Session().Note(DistrictId).Frame(PlacementTool.Area, 0);
			session.Watch.Reset();
			session.Frame(PlacementTool.Area, DistrictId).Place(DistrictId);

			Assert.Equal(new[] { PickSource.Game }, session.Arms.Select(arm => arm.Source));
			Assert.Equal(new[] { 1 }, session.SinceArm);
		}

		[Fact]
		public void APlacementSaysWhetherTheCameraMovedSinceTheArm()
		{
			var moved = Still with { X = 120 };
			var session = new Session()
				.Frame(PlacementTool.Net, SmallRoadId).Place(SmallRoadId)
				.Frame(PlacementTool.Net, SmallRoadId, moved).Place(SmallRoadId)
				.Frame(PlacementTool.Net, MediumRoadId, moved).Place(MediumRoadId);

			Assert.Equal(new[] { false, true, false }, session.Lines.OfType<PickPlace>().Select(place => place.CameraMoved));
		}

		[Fact]
		public void TheWatcherReadsTheKnobEachFrameAndWritesAPlacementOnlyWhileItIsOn()
		{
			var source = ModSource.Text("Systems/PlacementWatchSystem.cs");
			var observe = ModSource.Member(source, "private void ObservePicks(");

			// PreTool runs every frame, before the frame's ApplyTool counts.
			Assert.Contains("ObservePicks(snapshot, inHand);", ModSource.Member(source, "protected override void OnUpdate()"));
			Assert.Contains("var on = Knobs.Value(settings => settings.DevPickLogger, Tuning.PickLogger);", observe);
			Assert.Single(Regex.Matches(source, @"_picksOn = "));
			Assert.Contains("_picksOn = on;", observe);
			Assert.Contains("if (_picksOn) { try { Write(new PickEvent[] { _picks.Placed(", ModSource.Member(source, "private void Count("));
			Assert.Contains(
				"Mod.Settings is { } settings ? Tuning.Value(DeveloperMode, stored(settings), shipped) : shipped;",
				Regex.Replace(ModSource.Text("Utilities/Knobs.cs"), @"\s+", " "));
		}

		[Fact]
		public void ALoggerFailureLeavesTheCountingTheFlushAndTheirWarningAlone()
		{
			var source = ModSource.Text("Systems/PlacementWatchSystem.cs");
			const string Caught = "} catch (Exception ex) { PicksFailed(ex); }";

			// At PreTool, before the two-minute flush.
			var update = ModSource.Member(source, "protected override void OnUpdate()");
			var observed = update.IndexOf("try { ObservePicks(snapshot, inHand); " + Caught, StringComparison.Ordinal);
			Assert.InRange(observed, 0, update.IndexOf("FlushIfDirty();", StringComparison.Ordinal));

			// At ApplyTool, after the history counts the placement.
			var count = ModSource.Member(source, "private void Count(");
			var placed = count.IndexOf("try { Write(new PickEvent[] { _picks.Placed(", StringComparison.Ordinal);
			Assert.InRange(count.IndexOf("_history.Record(", StringComparison.Ordinal), 0, placed);
			Assert.Contains("BoxState.Closed) }); " + Caught, count);

			// At a load, before the flush.
			var preload = ModSource.Member(source, "protected override void OnGamePreload(");
			var forgot = preload.IndexOf("try { ForgetPicks(); " + Caught, StringComparison.Ordinal);
			Assert.InRange(forgot, 0, preload.IndexOf("FlushIfDirty();", StringComparison.Ordinal));

			// The logger's own warning: the counting's stays for the counting.
			var failed = ModSource.Member(source, "private void PicksFailed(");
			Assert.Contains("_warnedPicks", failed);
			Assert.DoesNotContain("_warnedUpdate", failed);
			Assert.DoesNotContain("Placement counting failed", failed);
			Assert.Single(Regex.Matches(source, "Placement counting failed"));
		}
	}
}
