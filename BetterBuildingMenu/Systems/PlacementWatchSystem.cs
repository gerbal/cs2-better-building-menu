using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Placement;
using BetterBuildingMenu.Utilities;

using Colossal.Serialization.Entities;

using Game;
using Game.Input;
using Game.Prefabs;
using Game.Rendering;
using Game.Tools;

using System.Diagnostics;

using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;

namespace BetterBuildingMenu.Systems
{
	/// <summary>
	/// Counts what the player places with the game's own tools into history.json, whatever
	/// the build menu's options, and feeds the pick logger while it is on. See
	/// docs/design-notes.md, "Counting placements" and "The pick logger".
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
		private static bool _loggedPointRead;

		private readonly PlacementCounter _counter = new(Rule);
		private readonly PickWatch _picks = new();
		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private PrefabIndexingSystem _indexer = null!;
		private UpdateSystem _updateSystem = null!;
		private CameraUpdateSystem _camera = null!;
		private PlacementHistory _history = new();
		private PlacementHistoryFile? _file;
		private PickLogFile? _picksFile;
		private TimeSpan _lastFlush;
		// The armed prefab's entity index, looked up again only when the prefab changes:
		// PreTool runs every frame.
		private PrefabBase? _lastPrefab;
		private int _lastPrefabId;
		private bool _warnedUpdate;
		// Whether the pick logger is on, as this frame's PreTool reads the knob, and whether it has warned.
		private bool _picksOn;
		private bool _warnedPicks;

		/// <summary>Whether BBM's menu is on screen, which the pick logger writes at each placement.</summary>
		internal bool BoxOpen { get; set; }

		protected override void OnCreate()
		{
			base.OnCreate();

			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_indexer = World.GetOrCreateSystemManaged<PrefabIndexingSystem>();
			_updateSystem = World.GetOrCreateSystemManaged<UpdateSystem>();
			_camera = World.GetOrCreateSystemManaged<CameraUpdateSystem>();

			try
			{
				_file = new PlacementHistoryFile(FolderUtil.ContentFolder, text => Mod.Log.Debug(text), text => Mod.Log.Warn(text));
				_picksFile = new PickLogFile(FolderUtil.ContentFolder, text => Mod.Log.Warn(text));
				_history = _file.Load();
			}
			catch (Exception ex)
			{
				// FolderUtil's static constructor creates the folder and can fail: count in
				// memory this session and keep nothing.
				Mod.Log.Warn(ex, "The placement history is not kept this session");
				_file = null;
				_picksFile = null;
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

				var snapshot = Snapshot(out var armedPrefabId);
				_counter.Observe(frame, snapshot);

				// The logger's own catch, here and at each of its calls: its failure leaves the
				// counting, the flush and the counting's warning alone.
				try
				{
					ObservePicks(armedPrefabId);
				}
				catch (Exception ex)
				{
					PicksFailed(ex);
				}

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

			try
			{
				ForgetPicks();
			}
			catch (Exception ex)
			{
				PicksFailed(ex);
			}

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

		/// <summary>BBM's menu asks the tool for this prefab, so the arm that follows reads as BBM's.</summary>
		internal void NoteBbmArm(int prefabId) => _picks.NoteBbmArm(prefabId);

		/// <summary>A tab, strip tab or school tier picked in BBM's menu.</summary>
		internal void TabSwitched()
		{
			if (_picksOn)
			{
				_picks.TabSwitched();
			}
		}

		private void Count(int frame)
		{
			var prefabId = _counter.Apply(frame);
			var key = prefabId == 0 ? null : PlacementMenuKey.Resolve(_indexer.Index, prefabId);

			if (key is { } placed)
			{
				_history.Record(placed.Menu, placed.Prefab, PlacementHistory.MarginOf(Knobs.Value(settings => settings.DevSlotMargin, Tuning.SlotMarginPercent)));

				if (_picksOn)
				{
					try
					{
						Write(new PickEvent[] { _picks.Placed(Seconds(), placed, PlacedAt(), BoxOpen ? BoxState.Open : BoxState.Closed) });
					}
					catch (Exception ex)
					{
						PicksFailed(ex);
					}
				}
			}

			if (Mod.Log.isDebugEnabled)
			{
				var seen = _counter.Snapshot;
				Mod.Log.Debug($"[PLACEMENT] frame {frame}: {seen.Tool} {seen.Kind}, prefab {seen.PrefabId}, {(seen.Open ? "open" : "closed")}: "
					+ (key is { } counted ? $"counted {counted.Prefab} in {counted.Menu}" : "not counted"));
			}
		}

		/// <summary>The pick logger's frame: whether it is on, then what the placing tool in hand holds and where the camera stands.</summary>
		/// <remarks>What is armed is read from the frame: the tool's own event misses an arm of the prefab it holds.</remarks>
		private void ObservePicks(int armedPrefabId)
		{
			var on = Knobs.Value(settings => settings.DevPickLogger, Tuning.PickLogger);

			if (on != _picksOn)
			{
				_picksOn = on;
				ForgetPicks();
			}

			if (!on)
			{
				return;
			}

			var position = _camera.position;
			var direction = _camera.direction;
			var camera = new CameraPose(position.x, position.y, position.z, direction.x, direction.y, direction.z);

			Write(_picks.Frame(Seconds(), armedPrefabId, camera, _indexer.Index));
		}

		/// <summary>A load, or the knob switching: nothing armed, no camera seen, no note kept.</summary>
		private void ForgetPicks() => _picks.Reset();

		/// <summary>The pick logger's own warning, once a session.</summary>
		private void PicksFailed(Exception ex)
		{
			if (!_warnedPicks)
			{
				_warnedPicks = true;
				Mod.Log.Warn(ex, "The pick logger failed; pick log lines may be missed this session");
			}
		}

		private void Write(IReadOnlyList<PickEvent> events)
		{
			if (events.Count > 0)
			{
				// Built here, inside the logger's catch, so a line that fails to build warns as the
				// logger's failure rather than as a failed write.
				_picksFile?.Append(events.Select(PickLogJson.Line).ToList());
			}
		}

		private static double Seconds() => UnityEngine.Time.realtimeSinceStartupAsDouble;

		/// <summary>Where on screen the placed building is: the tool's last point through the camera, else the pointer.</summary>
		private ScreenPoint PlacedAt()
		{
			var height = UnityEngine.Screen.height;

			if (LastPointOnScreen() is { } screen)
			{
				return ScreenPoint.FromPixels(screen.x, screen.y, height);
			}

			var pointer = InputManager.instance?.mousePosition ?? UnityEngine.Vector3.zero;

			return ScreenPoint.FromPixels(pointer.x, pointer.y, height);
		}

		/// <summary>The tool's last control point through the camera, in pixels; null when there is none to project or it cannot be read.</summary>
		/// <remarks>Read only on a frame that applies.</remarks>
		private UnityEngine.Vector3? LastPointOnScreen()
		{
			try
			{
				var camera = UnityEngine.Camera.main;

				if (camera == null || LastControlPoint(_toolSystem.activeTool) is not { } world)
				{
					return null;
				}

				var screen = camera.WorldToScreenPoint(new UnityEngine.Vector3(world.x, world.y, world.z));

				// Behind the camera, the projection lands nowhere the player looks.
				return screen.z > 0 ? screen : null;
			}
			catch (Exception ex)
			{
				// Once: the pointer stands in, here and at every placement after.
				if (!_loggedPointRead)
				{
					_loggedPointRead = true;
					Mod.Log.Debug($"[PLACEMENT] The tool's control points could not be read ({ex.Message}); the pick logger writes the pointer instead");
				}

				return null;
			}
		}

		/// <summary>The last control point of the object, net, area or route tool; null for any other tool, or when the list is empty.</summary>
		private static float3? LastControlPoint(ToolBaseSystem? tool) =>
			ControlPoints(tool) is { IsCreated: true, Length: > 0 } points ? points[points.Length - 1].m_Position : null;

		/// <summary>The object, net, area or route tool's control points, once its jobs are done with them; null for any other tool.</summary>
		private static NativeList<ControlPoint>? ControlPoints(ToolBaseSystem? tool)
		{
			NativeList<ControlPoint> points;
			JobHandle dependencies;

			switch (tool)
			{
				case ObjectToolSystem objectTool:
					points = objectTool.GetControlPoints(out dependencies);
					break;
				case NetToolSystem netTool:
					points = netTool.GetControlPoints(out dependencies);
					break;
				case AreaToolSystem areaTool:
					points = areaTool.GetControlPoints(out _, out dependencies);
					break;
				case RouteToolSystem routeTool:
					points = routeTool.GetControlPoints(out dependencies);
					break;
				default:
					return null;
			}

			dependencies.Complete();

			return points;
		}

		/// <param name="armedPrefabId">
		/// What the placing tool in hand in a city holds, whatever it is doing, for the pick logger;
		/// 0 for any other tool or nothing held.
		/// </param>
		private ToolSnapshot Snapshot(out int armedPrefabId)
		{
			armedPrefabId = 0;

			// In a city only: the editors use the same tools.
			if (!_toolSystem.actionMode.IsGame() || _toolSystem.activeTool is not { } tool)
			{
				return ToolSnapshot.None;
			}

			var placementTool = PlacementFilter.ToolOf(tool.GetType());

			if (placementTool == PlacementTool.None)
			{
				return ToolSnapshot.None;
			}

			// The area and route tools hold their prefab between placements, which the filter below drops.
			armedPrefabId = PrefabId(_toolSystem.activePrefab);
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

			return new ToolSnapshot(placementTool, kind, armedPrefabId, open);
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
				return ControlPoints(netTool) is { IsCreated: true, Length: >= 2 };
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
