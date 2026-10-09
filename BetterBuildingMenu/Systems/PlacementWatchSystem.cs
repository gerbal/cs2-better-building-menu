using BetterBuildingMenu.Domain.Placement;
using BetterBuildingMenu.Utilities;

using Colossal.Serialization.Entities;

using Game;
using Game.Prefabs;
using Game.Tools;

using System.Diagnostics;

namespace BetterBuildingMenu.Systems
{
	/// <summary>
	/// Counts what the player places with the game's own tools into history.json, whatever
	/// the build menu's options. See docs/design-notes.md, "Counting placements".
	/// </summary>
	/// <remarks>
	/// Registered twice. At PreTool, every frame, it reads what is armed before the tool
	/// updates, since a tool can hand over to another in the update that applies. At
	/// ApplyTool, which the game runs only on frames a tool applies, it counts.
	/// </remarks>
	internal sealed class PlacementWatchSystem : GameSystemBase
	{
		/// <summary>Burst, or PerArm if the live count check finds bursts cannot be told apart.</summary>
		internal const PlacementCountRule Rule = PlacementCountRule.Burst;

		private static readonly TimeSpan FlushEvery = TimeSpan.FromSeconds(120);
		private static readonly Stopwatch FlushClock = Stopwatch.StartNew();
		private static bool _loggedChainRead;

		private readonly PlacementCounter _counter = new(Rule);
		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private PrefabIndexingSystem _indexer = null!;
		private UpdateSystem _updateSystem = null!;
		private PlacementHistory _history = new();
		private PlacementHistoryFile? _file;
		private TimeSpan _lastFlush;
		// The armed prefab's entity index, looked up again only when the prefab changes:
		// PreTool runs every frame.
		private PrefabBase? _lastPrefab;
		private int _lastPrefabId;
		private bool _warnedUpdate;

		protected override void OnCreate()
		{
			base.OnCreate();

			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_indexer = World.GetOrCreateSystemManaged<PrefabIndexingSystem>();
			_updateSystem = World.GetOrCreateSystemManaged<UpdateSystem>();

			try
			{
				_file = new PlacementHistoryFile(FolderUtil.ContentFolder, text => Mod.Log.Debug(text), text => Mod.Log.Warn(text));
				_history = _file.Load();
			}
			catch (Exception ex)
			{
				// FolderUtil's static constructor creates the folder and can fail: count in
				// memory this session and keep nothing.
				Mod.Log.Warn(ex, "The placement history is not kept this session");
				_file = null;
			}
		}

		protected override void OnUpdate()
		{
			try
			{
				var frame = UnityEngine.Time.frameCount;

				if (_updateSystem.currentPhase == SystemUpdatePhase.ApplyTool)
				{
					Count(frame);
					return;
				}

				_counter.Observe(frame, Snapshot());

				if (FlushClock.Elapsed - _lastFlush >= FlushEvery)
				{
					FlushIfDirty();
				}
			}
			catch (Exception ex)
			{
				// The game logs a throwing system at every update. Once is enough.
				if (!_warnedUpdate)
				{
					_warnedUpdate = true;
					Mod.Log.Warn(ex, "Placement counting failed; placements may be missed this session");
				}
			}
		}

		protected override void OnGamePreload(Purpose purpose, GameMode mode)
		{
			base.OnGamePreload(purpose, mode);

			// A placement never spans a load, and a load is a moment the player is not placing.
			_counter.Reset();
			_lastPrefab = null;
			_lastPrefabId = 0;
			FlushIfDirty();
		}

		protected override void OnDestroy()
		{
			// At quit, after Mod.OnDispose: nothing here reads Mod.Settings.
			FlushIfDirty();
			base.OnDestroy();
		}

		/// <summary>Writes history.json if anything was placed since the last write. Never throws.</summary>
		internal void FlushIfDirty()
		{
			_lastFlush = FlushClock.Elapsed;
			_file?.FlushIfDirty(_history);
		}

		private void Count(int frame)
		{
			var prefabId = _counter.Apply(frame);
			var key = prefabId == 0 ? null : PlacementMenuKey.Resolve(_indexer.Index, prefabId);

			if (key is { } placed)
			{
				_history.Record(placed.Menu, placed.Prefab);
			}

			if (Mod.Log.isDebugEnabled)
			{
				var seen = _counter.Snapshot;
				Mod.Log.Debug($"[PLACEMENT] frame {frame}: {seen.Tool} {seen.Kind}, prefab {seen.PrefabId}, {(seen.Open ? "open" : "closed")}: "
					+ (key is { } counted ? $"counted {counted.Prefab} in {counted.Menu}" : "not counted"));
			}
		}

		private ToolSnapshot Snapshot()
		{
			// In a city only: the editors use the same tools.
			if (!_toolSystem.actionMode.IsGame() || _toolSystem.activeTool is not { } tool)
			{
				return ToolSnapshot.None;
			}

			var placementTool = PlacementFilter.ToolOf(tool.GetType());
			var kind = tool switch
			{
				ObjectToolSystem objectTool when placementTool == PlacementTool.Object => PlacementFilter.ObjectKind(objectTool.actualMode, objectTool.state),
				NetToolSystem netTool when placementTool == PlacementTool.Net => PlacementFilter.NetKind(netTool.actualMode),
				AreaToolSystem areaTool when placementTool == PlacementTool.Area => PlacementFilter.AreaKind(areaTool.actualMode, areaTool.state),
				RouteToolSystem routeTool when placementTool == PlacementTool.Route => PlacementFilter.RouteKind(routeTool.state),
				_ => PlacementKind.Ignored,
			};

			if (kind == PlacementKind.Ignored)
			{
				return ToolSnapshot.None;
			}

			var open = _counter.WantsOpenState && IsOpen(tool);

			return new ToolSnapshot(placementTool, kind, PrefabId(_toolSystem.activePrefab), open);
		}

		private int PrefabId(PrefabBase? prefab)
		{
			if (prefab is null)
			{
				return 0;
			}

			if (!ReferenceEquals(prefab, _lastPrefab))
			{
				_lastPrefab = prefab;
				_lastPrefabId = _prefabSystem.TryGetEntity(prefab, out var entity) ? entity.Index : 0;
			}

			return _lastPrefabId;
		}

		/// <summary>Whether the tool is still in the placement it last applied. Read only while a road or a stroke is open.</summary>
		/// <remarks>
		/// The brush reads Adding from the press to the release, on held frames that cannot plant
		/// (a spot with an error, the pointer off the ground) as on those that do.
		/// </remarks>
		private static bool IsOpen(ToolBaseSystem tool) => tool switch
		{
			NetToolSystem netTool => ChainOpen(netTool),
			ObjectToolSystem objectTool => objectTool.state == ObjectToolSystem.State.Adding,
			_ => false,
		};

		/// <summary>Whether the net tool is still drawing from the last point it placed.</summary>
		/// <remarks>Treated as open if it cannot be read.</remarks>
		private static bool ChainOpen(NetToolSystem netTool)
		{
			try
			{
				var points = netTool.GetControlPoints(out var dependencies);
				dependencies.Complete();

				return points.IsCreated && points.Length >= 2;
			}
			catch (Exception ex)
			{
				// Once: PreTool reads the chain every frame.
				if (!_loggedChainRead)
				{
					_loggedChainRead = true;
					Mod.Log.Debug($"[PLACEMENT] The net tool's control points could not be read ({ex.Message}); its road counts as still open");
				}

				return true;
			}
		}
	}
}
