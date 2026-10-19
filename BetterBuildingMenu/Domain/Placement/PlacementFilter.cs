using Game.Tools;

namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>Which of the game's placing tools is armed.</summary>
	public enum PlacementTool
	{
		/// <summary>Any other tool: the bulldozer, zoning, terrain, upgrades, another mod's.</summary>
		None,
		Object,
		Net,
		Area,
		Route,
	}

	/// <summary>How the tool's apply frames make up one placement.</summary>
	public enum PlacementKind
	{
		/// <summary>Not a placement: moving, upgrading, erasing, editing.</summary>
		Ignored,

		/// <summary>One apply is one placement: a building, a district, a transit line.</summary>
		Single,

		/// <summary>Applies while the button stays held are one placement: a brush stroke.</summary>
		Stroke,

		/// <summary>Applies while the course stays open are one placement: a road drawn segment by segment.</summary>
		Chain,
	}

	/// <summary>
	/// What counts as a placement: the game's object, net, area and route tools placing a
	/// prefab, matched by exact type.
	/// </summary>
	/// <remarks>
	/// Exact, because a mod's tool can derive from the game's and inherit its id. See
	/// docs/design-notes.md, "Counting placements".
	/// </remarks>
	public static class PlacementFilter
	{
		public static PlacementTool ToolOf(Type? toolType) =>
			toolType == typeof(ObjectToolSystem) ? PlacementTool.Object
			: toolType == typeof(NetToolSystem) ? PlacementTool.Net
			: toolType == typeof(AreaToolSystem) ? PlacementTool.Area
			: toolType == typeof(RouteToolSystem) ? PlacementTool.Route
			: PlacementTool.None;

		/// <param name="mode">The tool's actual mode, which maps a mode the prefab cannot use to Create.</param>
		public static PlacementKind ObjectKind(ObjectToolSystem.Mode mode, ObjectToolSystem.State state)
		{
			if (mode is ObjectToolSystem.Mode.Move or ObjectToolSystem.Mode.Upgrade || state == ObjectToolSystem.State.Removing)
			{
				return PlacementKind.Ignored;
			}

			return mode == ObjectToolSystem.Mode.Brush ? PlacementKind.Stroke : PlacementKind.Single;
		}

		/// <remarks>Replace puts a road upgrade on a road already there, once per drag.</remarks>
		public static PlacementKind NetKind(NetToolSystem.Mode mode) =>
			mode == NetToolSystem.Mode.Replace ? PlacementKind.Single : PlacementKind.Chain;

		public static PlacementKind AreaKind(AreaToolSystem.Mode mode, AreaToolSystem.State state) =>
			mode == AreaToolSystem.Mode.Edit && state == AreaToolSystem.State.Create ? PlacementKind.Single : PlacementKind.Ignored;

		public static PlacementKind RouteKind(RouteToolSystem.State state) =>
			state == RouteToolSystem.State.Create ? PlacementKind.Single : PlacementKind.Ignored;
	}
}
