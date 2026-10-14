namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>When a later apply of the same prefab counts again.</summary>
	public enum PlacementCountRule
	{
		/// <summary>After the stroke, road or building ends: see <see cref="PlacementKind"/>.</summary>
		Burst,

		/// <summary>Only after the armed tool or prefab changes: the fallback if bursts cannot be told apart.</summary>
		PerArm,
	}

	/// <summary>What was armed at the start of a frame, before the tool updated.</summary>
	/// <param name="PrefabId">The prefab entity's index, as the catalog index keys it; 0 for none.</param>
	/// <param name="Open">
	/// Whether the tool is still in the placement it last applied: the net tool drawing on from
	/// the last point placed, or the brush's button still held.
	/// </param>
	public readonly record struct ToolSnapshot(PlacementTool Tool, PlacementKind Kind, int PrefabId, bool Open)
	{
		public static readonly ToolSnapshot None = new(PlacementTool.None, PlacementKind.Ignored, 0, false);
	}

	/// <summary>
	/// Turns the game's apply frames into placements: one per stroke, road or building.
	/// </summary>
	/// <remarks>
	/// Fed a snapshot every frame before the tools update, and told of each frame a tool
	/// applies. The snapshot is the frame's own, because a tool can switch to another in the
	/// update that applies. See docs/design-notes.md, "Counting placements".
	/// </remarks>
	public sealed class PlacementCounter
	{
		/// <summary>
		/// The furthest apart two applies of one building, district or line can be, in frames:
		/// adjacent, as the net and area tools send an apply again after a focus change.
		/// </summary>
		public const int BurstGapFrames = 1;

		private readonly PlacementCountRule _rule;
		private ToolSnapshot _snapshot = ToolSnapshot.None;
		private int _snapshotFrame = -1;
		private bool _open;
		private ToolSnapshot _burst;
		private int _lastApplyFrame;

		public PlacementCounter(PlacementCountRule rule)
		{
			_rule = rule;
		}

		/// <summary>The latest snapshot, for the log.</summary>
		public ToolSnapshot Snapshot => _snapshot;

		/// <summary>Whether the next snapshot needs the tool's open state: only while a road or a stroke is open.</summary>
		public bool WantsOpenState => _rule == PlacementCountRule.Burst && _open && (_burst.Kind is PlacementKind.Chain or PlacementKind.Stroke);

		/// <summary>A frame's snapshot, taken before the tools update.</summary>
		public void Observe(int frame, ToolSnapshot snapshot)
		{
			_snapshot = snapshot;
			_snapshotFrame = frame;

			if (!_open)
			{
				return;
			}

			// Another tool or prefab ends the burst, and so does a road whose course closed or a
			// stroke whose button came up.
			if (snapshot.Tool != _burst.Tool || snapshot.PrefabId != _burst.PrefabId
				|| (WantsOpenState && !snapshot.Open))
			{
				_open = false;
			}
		}

		/// <summary>A frame on which the armed tool applied.</summary>
		/// <returns>The prefab's id when this apply starts a placement, else 0.</returns>
		public int Apply(int frame)
		{
			var seen = _snapshotFrame == frame ? _snapshot : ToolSnapshot.None;

			if (seen.Kind == PlacementKind.Ignored || seen.PrefabId == 0)
			{
				_open = false;
				return 0;
			}

			var continues = _open
				&& seen.Tool == _burst.Tool
				&& seen.PrefabId == _burst.PrefabId
				&& Continues(seen.Kind, frame);

			_lastApplyFrame = frame;

			if (continues)
			{
				return 0;
			}

			_open = true;
			_burst = seen;

			return seen.PrefabId;
		}

		/// <summary>A load ends whatever was being placed.</summary>
		public void Reset()
		{
			_open = false;
			_snapshot = ToolSnapshot.None;
			_snapshotFrame = -1;
		}

		private bool Continues(PlacementKind kind, int frame)
		{
			if (_rule == PlacementCountRule.PerArm)
			{
				return true;
			}

			if (kind != _burst.Kind)
			{
				return false;
			}

			// A road or a stroke lasts until Observe sees it close, whatever the frames between.
			return (kind is PlacementKind.Chain or PlacementKind.Stroke) || frame - _lastApplyFrame <= BurstGapFrames;
		}
	}
}
