namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Tells a toolbar menu the player chose from one the game echoed back.
	/// </summary>
	/// <remarks>
	/// Opening the lens makes the game re-assert the armed tool's asset menu, so
	/// a single click emits two selections. Observed live: clicking Garbage
	/// emits Garbage (17101) and then Education (17098), because an Elementary
	/// School was on the tool. Routing that second one reverts the player's
	/// choice inside the same tick, which is why the Zones menu appeared to open
	/// the zoning hierarchy and immediately abandon it.
	///
	/// The echo is indistinguishable from a click by content, so it is
	/// identified by proximity: a *different* menu arriving within a couple of
	/// frames of one we just applied is the game talking, not the player. Nobody
	/// clicks two menus within three frames, and the window is kept tight so
	/// deliberately switching menus quickly still works.
	/// </remarks>
	public static class MenuEchoGuard
	{
		/// <summary>
		/// Frames after applying a preset during which a different menu is
		/// treated as the game's echo rather than a new choice.
		/// </summary>
		public const int EchoWindowFrames = 2;

		public static bool IsEcho(int? appliedFrame, int appliedIndex, int currentFrame, int incomingIndex)
		{
			if (!appliedFrame.HasValue)
			{
				return false;
			}

			// Re-selecting the same menu is a real action; only a switch can be
			// an echo of what we just applied.
			if (incomingIndex == appliedIndex)
			{
				return false;
			}

			int elapsed = currentFrame - appliedFrame.Value;

			// A negative delta means the counter moved backwards; treat it as
			// outside the window rather than swallowing every later selection.
			return elapsed >= 0 && elapsed <= EchoWindowFrames;
		}
	}
}
