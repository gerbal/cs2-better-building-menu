using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Placement;

using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The pick logger between frames: an arm is what the placing tool in hand holds, BBM's note
	/// marks the next frame's arm, and the watcher reads the knob and keeps the logger's failures
	/// apart.
	/// </summary>
	public sealed class PickWatchTests
	{
		private const int DistrictId = 50;
		private const int ParkId = 51;
		private const int LineId = 60;
		private const int SmallRoadId = 10;
		private const int MediumRoadId = 11;
		private const int SchoolId = 30;

		private static readonly CatalogIndex Index = TestPrefabs.ReadyIndex(
			Filed(DistrictId, "Areas", "District"),
			Filed(ParkId, "Areas", "Park"),
			Filed(LineId, "Transportation", "Bus Line"),
			Filed(SmallRoadId, "Roads", "Small Road"),
			Filed(MediumRoadId, "Roads", "Medium Road"),
			Filed(SchoolId, "Education", "Elementary School"));

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

			/// <summary>A frame: what the placing tool in hand holds, 0 for no placing tool.</summary>
			public Session Frame(int prefabId, CameraPose? camera = null)
			{
				Lines.AddRange(Watch.Frame(++_seconds, prefabId, camera ?? Still, Index));

				return this;
			}

			/// <summary>Frames with the same building held: the area and route tools hold theirs between placements.</summary>
			public Session Held(int prefabId) => Frame(prefabId).Frame(prefabId).Frame(prefabId);

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
		[InlineData(DistrictId)]
		[InlineData(LineId)]
		public void TheToolIdleBetweenTwoPlacementsKeepsOneArm(int prefabId)
		{
			var session = new Session()
				.Held(prefabId).Place(prefabId)
				.Held(prefabId).Place(prefabId);

			Assert.Single(session.Arms);
			Assert.Equal(new[] { 1, 2 }, session.SinceArm);
		}

		[Fact]
		public void PuttingTheToolDownEndsTheArm()
		{
			var session = new Session()
				.Held(DistrictId).Place(DistrictId)
				.Frame(0)
				.Held(DistrictId).Place(DistrictId);

			Assert.Equal(new[] { "District", "District" }, session.Arms.Select(arm => arm.Prefab));
			Assert.Empty(session.Lines.OfType<PickSwap>());
			Assert.Equal(new[] { 1, 1 }, session.SinceArm);
		}

		[Fact]
		public void ARoadNeverPlacedThenABuildingIsASwap()
		{
			// The net tool hands straight over to the object tool: no frame with nothing armed between.
			var session = new Session().Held(SmallRoadId).Held(SchoolId);

			Assert.Equal(new[] { new PickSwap(4, "Education", "Elementary School", "Small Road") }, session.Lines.OfType<PickSwap>());
		}

		[Fact]
		public void ADistrictNeverDrawnThenAParkIsASwap()
		{
			var session = new Session().Held(DistrictId).Held(ParkId);

			Assert.Equal(new[] { new PickSwap(4, "Areas", "Park", "District") }, session.Lines.OfType<PickSwap>());
		}

		[Fact]
		public void BbmsNoteMarksOnlyTheNextFramesArm()
		{
			var session = new Session()
				.Note(SmallRoadId).Held(SmallRoadId).Place(SmallRoadId)
				.Held(MediumRoadId)
				// A note whose next frame arms nothing new marks nothing after it.
				.Note(SmallRoadId).Held(MediumRoadId).Held(SmallRoadId);

			Assert.Equal(new[] { PickSource.Bbm, PickSource.Game, PickSource.Game }, session.Arms.Select(arm => arm.Source));
		}

		[Fact]
		public void AResetForgetsBbmsNoteAndWhatIsArmed()
		{
			var session = new Session().Held(DistrictId).Note(DistrictId);
			session.Watch.Reset();
			session.Held(DistrictId).Place(DistrictId);

			Assert.Equal(new[] { PickSource.Game, PickSource.Game }, session.Arms.Select(arm => arm.Source));
			Assert.Equal(new[] { 1 }, session.SinceArm);
		}

		[Fact]
		public void APlacementSaysWhetherTheCameraMovedSinceTheArm()
		{
			var moved = Still with { X = 120 };
			var session = new Session()
				.Frame(SmallRoadId).Place(SmallRoadId)
				.Frame(SmallRoadId, moved).Place(SmallRoadId)
				.Frame(MediumRoadId, moved).Place(MediumRoadId);

			Assert.Equal(new[] { false, true, false }, session.Lines.OfType<PickPlace>().Select(place => place.CameraMoved));
		}

		[Fact]
		public void TheArmIsWhatThePlacingToolInHandHoldsWhateverItIsDoing()
		{
			var source = ModSource.Text("Systems/PlacementWatchSystem.cs");
			var snapshot = ModSource.Member(source, "private ToolSnapshot Snapshot(");
			var placingTool = snapshot.IndexOf("if (placementTool == PlacementTool.None) { return ToolSnapshot.None; }", StringComparison.Ordinal);
			var armed = snapshot.IndexOf("armedPrefabId = PrefabId(_toolSystem.activePrefab);", StringComparison.Ordinal);

			// Only the four placing tools, and before the counter's filter drops an idle area or route tool.
			Assert.InRange(placingTool, 0, armed);
			Assert.InRange(armed, 0, snapshot.IndexOf("if (kind == PlacementKind.Ignored)", StringComparison.Ordinal));
			Assert.Contains("_picks.Frame(Seconds(), armedPrefabId, camera, _indexer.Index)", ModSource.Member(source, "private void ObservePicks("));
		}

		[Fact]
		public void TheWatcherReadsTheKnobEachFrameAndWritesAPlacementOnlyWhileItIsOn()
		{
			var source = ModSource.Text("Systems/PlacementWatchSystem.cs");
			var observe = ModSource.Member(source, "private void ObservePicks(");

			// PreTool runs every frame, before the frame's ApplyTool counts.
			Assert.Contains("ObservePicks(armedPrefabId);", ModSource.Member(source, "protected override void OnUpdate()"));
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
			var observed = update.IndexOf("try { ObservePicks(armedPrefabId); " + Caught, StringComparison.Ordinal);
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
