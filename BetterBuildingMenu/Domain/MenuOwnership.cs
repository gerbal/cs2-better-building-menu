namespace BetterBuildingMenu.Domain
{
	/// <summary>What the build menu does when the control scheme changes or a toolbar menu opens.</summary>
	public enum HandOffAction
	{
		/// <summary>Nothing changes hands.</summary>
		None,

		/// <summary>BBM gives the menu to the game's own, and leaves the toolbar's selection alone.</summary>
		Yield,

		/// <summary>BBM takes back the menu it has given up, as a fresh open.</summary>
		Reopen,
	}

	/// <summary>A hand-off: what to do, and the menu recorded for the mouse's return afterwards.</summary>
	/// <param name="Action">What to do now. A reopen opens the menu recorded before this change.</param>
	/// <param name="Recorded">The toolbar menu to take back when the mouse returns, or 0 for none.</param>
	public readonly record struct HandOff(HandOffAction Action, int Recorded);

	/// <summary>
	/// Whose build menu stands in for the toolbar's open menu: BBM's only while Replace the vanilla
	/// build menu is on and the player is not on a gamepad, which BBM's controls cannot serve.
	/// </summary>
	/// <remarks>
	/// Menus are the toolbar's entity indices, 0 for none. See docs/design-notes.md, "The game's
	/// own menu under a gamepad".
	/// </remarks>
	public static class MenuOwnership
	{
		/// <summary>Whether BBM may stand in for a toolbar menu now.</summary>
		public static bool MayOwn(bool replaceEnabled, bool gamepad) => replaceEnabled && !gamepad;

		/// <summary>The control scheme changed.</summary>
		/// <param name="gamepad">Whether the new scheme is the gamepad.</param>
		/// <param name="replaceEnabled">Whether Replace the vanilla build menu is on.</param>
		/// <param name="ownedMenu">The menu BBM stands in for, or 0.</param>
		/// <param name="recorded">The menu BBM has given up and recorded, or 0.</param>
		public static HandOff SchemeChanged(bool gamepad, bool replaceEnabled, int ownedMenu, int recorded)
		{
			if (gamepad)
			{
				return ownedMenu != 0 ? new HandOff(HandOffAction.Yield, ownedMenu) : new HandOff(HandOffAction.None, recorded);
			}

			// The mouse is back: the recorded menu returns once, and is then forgotten.
			return MayOwn(replaceEnabled, gamepad: false) && recorded != 0
				? new HandOff(HandOffAction.Reopen, 0)
				: new HandOff(HandOffAction.None, 0);
		}

		/// <summary>A toolbar menu opened, with Replace on: under a gamepad it stays the game's, recorded for the mouse.</summary>
		public static HandOff MenuSelected(bool gamepad, int menu) =>
			gamepad ? new HandOff(HandOffAction.Yield, menu) : new HandOff(HandOffAction.None, 0);
	}
}
