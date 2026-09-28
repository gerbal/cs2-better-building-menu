namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Tells a toolbar menu the player chose from one the game echoed back.
	/// </summary>
	/// <remarks>
	/// Opening the asset menu makes the game re-assert the armed tool's own menu, so one
	/// click emits two selections. The echo is indistinguishable from a click by
	/// content, so it is caught by proximity: nobody switches menus within a frame or two.
	/// </remarks>
	public static class MenuEchoGuard
	{
		/// <summary>
		/// Frames after applying a preset during which a different menu is the game's
		/// echo rather than a new choice.
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
