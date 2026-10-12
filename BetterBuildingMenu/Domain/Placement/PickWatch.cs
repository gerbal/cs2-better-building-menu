using BetterBuildingMenu.Domain.Catalog;

namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>
	/// The pick logger between frames: the placing tool in hand, the building it has armed, where
	/// the camera stands and BBM's note of the prefab its menu asks for. Turns what the placement
	/// watcher reads each frame into the pick log's arms.
	/// </summary>
	/// <remarks>
	/// Pure. An arm lasts while its tool stays in hand, since the area and route tools read as
	/// nothing armed between placements. See docs/design-notes.md, "The pick logger".
	/// </remarks>
	public sealed class PickWatch
	{
		private readonly PickLog _log = new();
		private PlacementTool _tool;
		private int _armedPrefabId;
		private CameraPose? _lastPose;
		private int _bbmArm;
		// Whether BBM's note is new since the last frame: a note made as BBM's arm puts a tool in
		// hand belongs to that tool.
		private bool _bbmArmNew;

		/// <summary>BBM's menu asks the tool for this prefab, so the arm that follows reads as BBM's.</summary>
		public void NoteBbmArm(int prefabId)
		{
			_bbmArm = prefabId;
			_bbmArmNew = true;
		}

		/// <summary>A frame, read before the tools update.</summary>
		/// <param name="seconds">Since the game starts.</param>
		/// <param name="tool">The placing tool in hand; None for any other tool.</param>
		/// <param name="prefabId">What the counter's snapshot has armed; 0 for nothing.</param>
		/// <param name="camera">Where the camera stands.</param>
		/// <param name="index">Where an armed prefab is filed.</param>
		/// <returns>An arm, and a swap after it, when the tool in hand arms another building; else nothing.</returns>
		public IReadOnlyList<PickEvent> Frame(double seconds, PlacementTool tool, int prefabId, CameraPose camera, CatalogIndex index)
		{
			if (_lastPose is { } before && camera.MovedFrom(before))
			{
				_log.CameraMoved();
			}

			_lastPose = camera;
			var noteIsNew = _bbmArmNew;
			_bbmArmNew = false;

			if (tool != _tool)
			{
				// The arm ends with its tool, and so does a note made before the change.
				_tool = tool;
				_armedPrefabId = 0;
				_log.Armed(seconds, null, PickSource.Game);

				if (!noteIsNew)
				{
					_bbmArm = 0;
				}
			}

			// Nothing armed with the same tool in hand is the area or route tool between placements.
			if (prefabId == 0 || prefabId == _armedPrefabId)
			{
				return Array.Empty<PickEvent>();
			}

			var events = _log.Armed(seconds, PlacementMenuKey.Resolve(index, prefabId), PickLog.SourceOf(prefabId, _bbmArm));
			_armedPrefabId = prefabId;
			_bbmArm = 0;

			return events;
		}

		/// <summary>A tab, strip tab or school tier picked in BBM's menu.</summary>
		public void TabSwitched() => _log.TabSwitched();

		/// <summary>A placement the history counts.</summary>
		public PickPlace Placed(double seconds, PlacementKey placed, ScreenPoint at, BoxState box) => _log.Placed(seconds, placed, at, box);

		/// <summary>A load, or the knob switching: no tool in hand, nothing armed, no camera seen, no note kept.</summary>
		public void Reset()
		{
			_log.Reset();
			_tool = PlacementTool.None;
			_armedPrefabId = 0;
			_lastPose = null;
			_bbmArm = 0;
			_bbmArmNew = false;
		}
	}
}
