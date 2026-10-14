using BetterBuildingMenu.Domain.Catalog;

namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>
	/// The pick logger between frames: the building the placing tool in hand holds, where the
	/// camera stands and BBM's note of the prefab its menu asks for. Turns what the placement
	/// watcher reads each frame into the pick log's arms.
	/// </summary>
	/// <remarks>Pure. See docs/design-notes.md, "The pick logger".</remarks>
	public sealed class PickWatch
	{
		private readonly PickLog _log = new();
		private int _armedPrefabId;
		private CameraPose? _lastPose;
		private int _bbmArm;

		/// <summary>BBM's menu asks the tool for this prefab, so the next frame's arm reads as BBM's.</summary>
		/// <remarks>The tool takes the prefab at once, before the note, so the next frame reads it.</remarks>
		public void NoteBbmArm(int prefabId) => _bbmArm = prefabId;

		/// <summary>A frame, read before the tools update.</summary>
		/// <param name="seconds">Since the game starts.</param>
		/// <param name="prefabId">What the placing tool in hand holds, whatever it is doing; 0 for no placing tool or nothing held.</param>
		/// <param name="camera">Where the camera stands.</param>
		/// <param name="index">Where an armed prefab is filed.</param>
		/// <returns>An arm, and a swap after it, when another building is held; else nothing.</returns>
		public IReadOnlyList<PickEvent> Frame(double seconds, int prefabId, CameraPose camera, CatalogIndex index)
		{
			if (_lastPose is { } before && camera.MovedFrom(before))
			{
				_log.CameraMoved();
			}

			_lastPose = camera;

			// BBM's note marks this frame's arm only.
			var bbmArm = _bbmArm;
			_bbmArm = 0;

			if (prefabId == _armedPrefabId)
			{
				return Array.Empty<PickEvent>();
			}

			_armedPrefabId = prefabId;
			var armed = prefabId == 0 ? null : PlacementMenuKey.Resolve(index, prefabId);

			return _log.Armed(seconds, armed, PickLog.SourceOf(prefabId, bbmArm));
		}

		/// <summary>A tab, strip tab or school tier picked in BBM's menu.</summary>
		public void TabSwitched() => _log.TabSwitched();

		/// <summary>A placement the history counts.</summary>
		public PickPlace Placed(double seconds, PlacementKey placed, ScreenPoint at, BoxState box) => _log.Placed(seconds, placed, at, box);

		/// <summary>A load, or the knob switching: nothing armed, no camera seen, no note kept.</summary>
		public void Reset()
		{
			_log.Reset();
			_armedPrefabId = 0;
			_lastPose = null;
			_bbmArm = 0;
		}
	}
}
