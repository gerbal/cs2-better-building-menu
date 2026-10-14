namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The toolbar menu BBM has given the game's own while a gamepad is in use, to take back when
	/// the mouse returns, and each event that records or forgets it.
	/// </summary>
	/// <remarks>
	/// A load and Replace switched off reach BBM with no deselect, so each forgets the record here:
	/// one kept past them would reopen a menu the toolbar no longer has. See docs/design-notes.md,
	/// "The game's own menu under a gamepad".
	/// </remarks>
	public sealed class GamepadMenuRecord
	{
		/// <summary>The toolbar menu given up, or 0 for none.</summary>
		public int Menu { get; private set; }

		/// <summary>The control scheme changed. See <see cref="MenuOwnership.SchemeChanged"/>.</summary>
		/// <param name="reopen">The menu a reopen opens: the one recorded before this change.</param>
		public HandOffAction SchemeChanged(bool gamepad, bool replaceEnabled, int ownedMenu, bool toolbarHasMenu, out int reopen)
		{
			var handOff = MenuOwnership.SchemeChanged(gamepad, replaceEnabled, ownedMenu, Menu, toolbarHasMenu);

			reopen = handOff.Action == HandOffAction.Reopen ? Menu : 0;
			Menu = handOff.Recorded;

			return handOff.Action;
		}

		/// <summary>A toolbar menu opened with Replace on: under a gamepad it is recorded and left to the game.</summary>
		public HandOffAction MenuSelected(bool gamepad, int menu)
		{
			var handOff = MenuOwnership.MenuSelected(gamepad, menu);

			if (handOff.Action == HandOffAction.Yield)
			{
				Menu = handOff.Recorded;
			}

			return handOff.Action;
		}

		/// <summary>The toolbar's menu closed, or a load cleared it: nothing is left to take back.</summary>
		public void Forget() => Menu = 0;

		/// <summary>The settings were applied: with Replace off no menu is BBM's to take back.</summary>
		public void SettingsApplied(bool replaceEnabled)
		{
			if (!replaceEnabled)
			{
				Forget();
			}
		}
	}
}
