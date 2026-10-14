namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>How a building came to be armed, as far as C# can tell.</summary>
	public enum PickSource
	{
		/// <summary>BBM's own arm: a row or Enter in its menu.</summary>
		Bbm,

		/// <summary>Any arm BBM did not make: the game's own menu, its re-arm, another mod.</summary>
		Game,
	}

	/// <summary>Whether BBM's menu is on screen at a placement.</summary>
	public enum BoxState
	{
		Open,
		Closed,
	}

	/// <summary>A point on screen, in rem from the top left, to a tenth: a screen is 1,080 rem tall at any resolution.</summary>
	public readonly record struct ScreenPoint(double X, double Y)
	{
		/// <summary>A point in pixels counted up from the bottom left, as Unity's screen space has it.</summary>
		public static ScreenPoint FromPixels(float x, float y, float screenHeight)
		{
			if (!(screenHeight > 0))
			{
				return new ScreenPoint(0, 0);
			}

			var rem = WidthSteps.LayoutHeight / screenHeight;

			return new ScreenPoint(Tenth(x * rem), Tenth((screenHeight - y) * rem));
		}

		private static double Tenth(double value) => Math.Round(value, 1, MidpointRounding.AwayFromZero);
	}

	/// <summary>Where the camera stands and looks, to tell whether it moves between an arm and a placement.</summary>
	public readonly record struct CameraPose(float X, float Y, float Z, float DirectionX, float DirectionY, float DirectionZ)
	{
		/// <summary>The least the camera must move to count: a centimetre.</summary>
		public const float PositionTolerance = 0.01f;

		/// <summary>The least the view direction must turn to count, per component of its unit vector.</summary>
		public const float DirectionTolerance = 0.0001f;

		public bool MovedFrom(CameraPose before) =>
			Beyond(X, before.X, PositionTolerance) || Beyond(Y, before.Y, PositionTolerance) || Beyond(Z, before.Z, PositionTolerance)
			|| Beyond(DirectionX, before.DirectionX, DirectionTolerance)
			|| Beyond(DirectionY, before.DirectionY, DirectionTolerance)
			|| Beyond(DirectionZ, before.DirectionZ, DirectionTolerance);

		private static bool Beyond(float now, float before, float tolerance) => Math.Abs(now - before) > tolerance;
	}

	/// <summary>One line of the pick log.</summary>
	/// <param name="Seconds">Since the game starts.</param>
	/// <param name="Menu">The game menu the building is filed under.</param>
	/// <param name="Prefab">The building's prefab name.</param>
	public abstract record PickEvent(double Seconds, string Menu, string Prefab);

	/// <summary>A building armed.</summary>
	public sealed record PickArm(double Seconds, string Menu, string Prefab, PickSource Source) : PickEvent(Seconds, Menu, Prefab);

	/// <summary>An arm that replaces an armed building nothing has been placed with.</summary>
	/// <param name="From">The prefab it replaces.</param>
	public sealed record PickSwap(double Seconds, string Menu, string Prefab, string From) : PickEvent(Seconds, Menu, Prefab);

	/// <summary>A placement, as the placement history counts it.</summary>
	/// <param name="At">Where on screen the placed building is.</param>
	/// <param name="CameraMoved">Whether the camera has moved since the arm.</param>
	/// <param name="Box">Whether BBM's menu is on screen.</param>
	/// <param name="TabSwitches">The tab switches in BBM's menu since the previous placement.</param>
	/// <param name="SinceArm">This placement's number since the arm, from 1.</param>
	public sealed record PickPlace(double Seconds, string Menu, string Prefab, ScreenPoint At, bool CameraMoved, BoxState Box, int TabSwitches, int SinceArm)
		: PickEvent(Seconds, Menu, Prefab);

	/// <summary>
	/// Turns what the placement watcher sees into the pick log's lines: arms with their source,
	/// swaps, and placements with what is around them.
	/// </summary>
	/// <remarks>
	/// Pure; PlacementWatchSystem feeds it only while the Pick logger knob is on in developer mode.
	/// See docs/design-notes.md, "The pick logger".
	/// </remarks>
	public sealed class PickLog
	{
		private PlacementKey? _armed;
		private int _placedSinceArm;
		private bool _cameraMoved;
		private int _tabSwitches;

		/// <summary>An arm is BBM's when it is the prefab BBM's menu last asked for, else the game's.</summary>
		public static PickSource SourceOf(int armedPrefabId, int bbmArmedPrefabId) =>
			armedPrefabId != 0 && armedPrefabId == bbmArmedPrefabId ? PickSource.Bbm : PickSource.Game;

		/// <summary>What is armed now: a placing tool with a building in a game menu, or null for none.</summary>
		/// <returns>
		/// Nothing when what is armed does not change; else, for a building, its arm, and after it a
		/// swap when it replaces a building nothing has been placed with.
		/// </returns>
		public IReadOnlyList<PickEvent> Armed(double seconds, PlacementKey? armed, PickSource source)
		{
			if (Nullable.Equals(armed, _armed))
			{
				return Array.Empty<PickEvent>();
			}

			var replaced = _placedSinceArm == 0 ? _armed : null;
			_armed = armed;
			_placedSinceArm = 0;
			_cameraMoved = false;

			if (armed is not { } now)
			{
				return Array.Empty<PickEvent>();
			}

			var arm = new PickArm(seconds, now.Menu, now.Prefab, source);

			return replaced is { } before
				? new PickEvent[] { arm, new PickSwap(seconds, now.Menu, now.Prefab, before.Prefab) }
				: new PickEvent[] { arm };
		}

		/// <summary>The camera moves this frame.</summary>
		public void CameraMoved() => _cameraMoved = true;

		/// <summary>A tab, strip tab or school tier picked in BBM's menu.</summary>
		public void TabSwitched() => _tabSwitches++;

		/// <summary>A placement the history counts.</summary>
		public PickPlace Placed(double seconds, PlacementKey placed, ScreenPoint at, BoxState box)
		{
			_placedSinceArm++;
			var place = new PickPlace(seconds, placed.Menu, placed.Prefab, at, _cameraMoved, box, _tabSwitches, _placedSinceArm);
			_tabSwitches = 0;

			return place;
		}

		/// <summary>A load, or the knob switching: nothing armed, nothing counted.</summary>
		public void Reset()
		{
			_armed = null;
			_placedSinceArm = 0;
			_cameraMoved = false;
			_tabSwitches = 0;
		}
	}
}
