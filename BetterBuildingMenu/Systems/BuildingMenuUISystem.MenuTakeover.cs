using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;

using Game.Input;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		// The toolbar menu BBM has given the game's own while a gamepad is in use, to take back
		// when the mouse returns.
		private readonly GamepadMenuRecord _gamepadMenu = new();

		// Set once the handler has warned, so a failing handler logs once per session.
		private bool _controlSchemeWarned;

		/// <summary>
		/// Gives the menu BBM stands in for to the game's own when the player picks up a gamepad,
		/// and takes it back, on the same menu, when the mouse returns.
		/// </summary>
		/// <remarks>
		/// The toolbar's selection is left alone both ways. Runs inside the game's input code, so
		/// it does nothing once the settings are gone and never throws. See docs/design-notes.md,
		/// "The game's own menu under a gamepad".
		/// </remarks>
		private void OnControlSchemeChanged(InputManager.ControlScheme scheme)
		{
			if (Mod.Settings is null)
			{
				return;
			}

			try
			{
				// The toolbar itself is asked whether a menu is open: a load clears it with no deselect
				// reaching BBM.
				var action = _gamepadMenu.SchemeChanged(
					scheme == InputManager.ControlScheme.Gamepad,
					Mod.Settings.ReplaceVanillaBuildMenu,
					_OwnsCurrentMenu.Value ? _appliedMenuIndex : 0,
					_toolbarUISystem.hasActiveSelection,
					out var reopen);

				switch (action)
				{
					case HandOffAction.Yield:
						YieldMenuToVanilla();
						break;
					case HandOffAction.Reopen:
						// A fresh open, which the echo guard must not take for the game's echo.
						_appliedMenuFrame = null;
						VanillaMenuSelected(reopen);
						break;
				}
			}
			catch (System.Exception ex)
			{
				if (!_controlSchemeWarned)
				{
					_controlSchemeWarned = true;
					Mod.Log.Warn(ex, "Could not hand the build menu over for a control scheme change");
				}
			}
		}

		/// <summary>
		/// Closes the asset menu and, when it was standing in for a vanilla menu,
		/// releases that menu's selection on the toolbar.
		/// </summary>
		/// <remarks>
		/// Clearing the selection tells the game the menu went away, so the next press of that
		/// button opens it instead of reading as a deselect. Only the deliberate close paths
		/// call this, never OnToolChanged, which fires on every return to the default tool.
		/// </remarks>
		private void CloseAssetMenu()
		{
			bool ownedMenu = _OwnsCurrentMenu.Value;

			SetAssetMenuOpen(false);

			// The window lock refuses the close, so the menu is still on screen.
			if (_assetMenuOpen)
			{
				return;
			}

			ReleaseMenuScope();

			if (ownedMenu)
			{
				_OwnsCurrentMenu.Value = false;
				_toolbarUISystem.ClearAssetSelection();
			}
		}

		/// <summary>
		/// Forgets the vanilla menu the asset menu was standing in for.
		/// </summary>
		/// <remarks>
		/// Shared by both close paths, so the scope cannot survive one of them and leave the
		/// next open filtered to whichever menu was clicked last.
		/// </remarks>
		private void ReleaseMenuScope()
		{
			_assetMenu = _assetMenu.ClearMenuScope();
			PublishScope();
		}

		/// <summary>
		/// Hand this menu back to vanilla: we do not own it, and nothing of
		/// ours is left covering it.
		/// </summary>
		/// <remarks>
		/// One method rather than the same three lines at each call site: a caller that writes
		/// only part of it leaves the asset menu covering a menu it no longer owns.
		/// </remarks>
		private void YieldMenuToVanilla()
		{
			_OwnsCurrentMenu.Value = false;

			if (_assetMenuOpen)
			{
				SetAssetMenuOpen(false);
			}
		}

		/// <summary>The prefab the game has armed, as the index's id, or 0 for none.</summary>
		/// <remarks>
		/// Read from the tool when asked: a bar press re-arms the menu's last building before the open
		/// reaches BBM, so the open sees it. See docs/design-notes.md, "Opening on the building's tab".
		/// </remarks>
		private int ArmedEntryId() => EntryIdOf(_toolSystem.activePrefab);

		/// <summary>
		/// A vanilla toolbar menu was opened: show the asset menu filtered to it.
		/// </summary>
		/// <remarks>
		/// Declines quietly whenever the asset menu has nothing better to offer than the vanilla grid
		/// — the setting is off, or the menu has no name in the index — so that menu keeps
		/// working untouched. Every named vanilla menu routes here, Roads and Landscaping too.
		/// </remarks>
		private void VanillaMenuSelected(int menuEntityIndex)
		{
			if (!Mod.Settings.ReplaceVanillaBuildMenu)
			{
				YieldMenuToVanilla();
				return;
			}

			// Under a gamepad the game's own menu serves, and this one is taken back for the mouse.
			if (_gamepadMenu.MenuSelected(InputManager.instance?.isGamepadControlSchemeActive == true, menuEntityIndex) == HandOffAction.Yield)
			{
				YieldMenuToVanilla();
				return;
			}

			// Opening the asset menu makes the game re-assert the armed tool's menu, so one
			// click arrives as two selections.
			if (MenuEchoGuard.IsEcho(_appliedMenuFrame, _appliedMenuIndex, UnityEngine.Time.frameCount, menuEntityIndex))
			{
				return;
			}

			// The menu's own name is the whole constraint the query needs: assets carry
			// the menu the game placed them in, and MenuName resolves the
			// UIAssetMenuPrefab's name, which is that same untranslated string.
			var menuName = _indexer.Index.Menus.MenuName(menuEntityIndex);

			// A menu the index never saw, or one it holds nothing for (a mod's menu
			// built from nested categories): the asset menu sits where the vanilla grid
			// appears, so get out of the way rather than draw an empty one.
			if (MenuRouting.ShouldYield(
				replaceEnabled: true,
				menuName: menuName,
				menuHasAssets: BuildingCatalogAdapter.MenuHasAssets(_indexer.Index, menuName ?? string.Empty, _toolbarSelection)))
			{
				YieldMenuToVanilla();
				return;
			}

			// The tab and the row the open rule picks, over the menu as it opens, with the menu's own GROUP
			// and its SORT this session. See CatalogView.Opening.
			var armed = ArmedEntryId();
			var memory = _sessionSorts.For(menuName, MenuPicks.Get(Mod.Settings.MenuGroups, menuName));
			_assetMenu = _assetMenu.OpenMenu(menuName, opened => _buildingCatalogAdapter.Build(_indexer.Source, opened, _toolbarSelection).Opening(armed), memory);
			// Vanilla drops a category's highlight as its selection moves off it; the asset menu never
			// moves that selection, so an open clears the menu's highlights, whichever tab it opens on.
			ClearVanillaMenuHighlights(menuName);
			PublishScope();

			_appliedMenuIndex = menuEntityIndex;
			_appliedMenuFrame = UnityEngine.Time.frameCount;
			_OwnsCurrentMenu.Value = true;

			// Opening a menu never arms a prefab. Arming one makes the game re-assert
			// that prefab's menu as the selection, which leaves the toolbar highlight
			// on one menu while the asset menu shows another.

			// Exactly one refresh whichever way we got here: SetAssetMenuOpen early-returns
			// when the asset menu is already visible, which is precisely the menu-to-menu
			// switch, so the refresh fits neither only inside the toggle nor only outside.
			var wasOpen = _assetMenuOpen;
			SetAssetMenuOpen(true);

			if (wasOpen)
			{
				RefreshAssetMenu();
			}
		}

		/// <summary>
		/// Closes the asset menu when the toolbar drops the menu it was standing in for.
		/// </summary>
		/// <remarks>
		/// A toolbar menu button toggles, so a second click on the lit icon deselects the menu
		/// the asset menu stands for. Only acts when the asset menu owns the current menu: one handed back
		/// to vanilla is the vanilla grid's business to close.
		/// </remarks>
		private void VanillaMenuDeselected()
		{
			// Before the check below: a menu closing under a gamepad is the game's, and leaves
			// nothing to take back.
			_gamepadMenu.Forget();

			if (!Mod.Settings.ReplaceVanillaBuildMenu || !_OwnsCurrentMenu)
			{
				return;
			}

			// The echo guard compares against the menu last applied. Leaving the
			// old index here would make reopening that same menu look like an echo
			// of a menu that is no longer on screen.
			_appliedMenuIndex = 0;
			_appliedMenuFrame = null;
			_OwnsCurrentMenu.Value = false;

			// The same release CloseAssetMenu does. A toolbar deselect is a close like any
			// other, and an asset menu that forgets its menu on only one of the two paths
			// filters by whichever button you happened to use.
			ReleaseMenuScope();

			if (_assetMenuOpen)
			{
				SetAssetMenuOpen(false);
			}
		}

		internal void SetAssetMenuOpen(bool visible)
		{
			if (_assetMenuOpen == visible)
			{
				return;
			}

			_assetMenuOpen = visible;
			// The pick logger writes it at each placement.
			_placementWatch.BoxOpen = visible;

			if (!visible)
			{
				// A close is a moment the player is not placing: keep what they placed.
				_placementWatch.FlushIfDirty();
				return;
			}

			RefreshAssetMenu();

			// RefreshAssetMenu already ran RefreshBuildingCatalog, which refreshes the options
			// bank itself once its facet bindings are current.
		}

		/// <summary>
		/// Closes the menu the asset menu stands in for when the map selects something new, so the
		/// game draws that selection's panel. See SelectionHandOff.
		/// </summary>
		private void HandSelectionToTheGame()
		{
			var selected = _selectedInfoUISystem.selectedEntity;
			var changed = selected != _lastSelectedEntity;
			_lastSelectedEntity = selected;

			if (SelectionHandOff.ShouldCloseMenu(changed, selected != Entity.Null, _assetMenuOpen, _OwnsCurrentMenu.Value))
			{
				CloseAssetMenu();
			}
		}
	}
}
