using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Closes the lens and, when it was standing in for a vanilla menu,
		/// releases that menu's selection on the toolbar.
		/// </summary>
		/// <remarks>
		/// Clearing the selection tells the game the menu went away, so the next press of that
		/// button opens it instead of reading as a deselect. Only the deliberate close paths
		/// call this, never OnToolChanged, which fires on every return to the default tool.
		/// </remarks>
		private void CloseLens()
		{
			bool ownedMenu = _LensOwnsCurrentMenu.Value;

			SetLensMenuOpen(false);

			// The window lock refuses the close, so the menu is still on screen.
			if (_lensMenuOpen)
			{
				return;
			}

			ReleaseMenuScope();

			if (ownedMenu)
			{
				_LensOwnsCurrentMenu.Value = false;
				_toolbarUISystem.ClearAssetSelection();
			}
		}

		/// <summary>
		/// Forgets the vanilla menu the lens was standing in for.
		/// </summary>
		/// <remarks>
		/// Shared by both close paths, so the scope cannot survive one of them and leave the
		/// next open filtered to whichever menu was clicked last.
		/// </remarks>
		private void ReleaseMenuScope()
		{
			_lens = _lens.ClearMenuScope();
			PublishScope();
		}

		/// <summary>
		/// Hand this menu back to vanilla: we do not own it, and nothing of
		/// ours is left covering it.
		/// </summary>
		/// <remarks>
		/// One method rather than the same three lines at each call site: a caller that writes
		/// only part of it leaves the lens covering a menu it no longer owns.
		/// </remarks>
		private void YieldMenuToVanilla()
		{
			_LensOwnsCurrentMenu.Value = false;

			if (_lensMenuOpen)
			{
				SetLensMenuOpen(false);
			}
		}

		/// <summary>
		/// A vanilla toolbar menu was opened: show the lens filtered to it.
		/// </summary>
		/// <remarks>
		/// Declines quietly whenever the lens has nothing better to offer than the vanilla grid
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

			// Opening the lens makes the game re-assert the armed tool's menu, so one
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
			// built from nested categories): the panel sits where the vanilla grid
			// appears, so get out of the way rather than draw an empty one.
			if (MenuRouting.ShouldYield(
				replaceEnabled: true,
				menuName: menuName,
				menuHasAssets: BuildingCatalogAdapter.MenuHasAssets(_indexer.Index, menuName ?? string.Empty, _toolbarSelection)))
			{
				YieldMenuToVanilla();
				return;
			}

			_lens = _lens.SelectMenu(menuName);
			// The player is now looking at everything this menu holds, which is
			// what vanilla treats as having seen it.
			ClearVanillaMenuHighlights(menuName);
			PublishScope();

			_appliedMenuIndex = menuEntityIndex;
			_appliedMenuFrame = UnityEngine.Time.frameCount;
			_LensOwnsCurrentMenu.Value = true;

			// Opening a menu never arms a prefab. Arming one makes the game re-assert
			// that prefab's menu as the selection, which leaves the toolbar highlight
			// on one menu while the lens shows another.

			// Exactly one refresh whichever way we got here: SetLensMenuOpen early-returns
			// when the panel is already visible, which is precisely the menu-to-menu
			// switch, so the refresh fits neither only inside the toggle nor only outside.
			var wasOpen = _lensMenuOpen;
			SetLensMenuOpen(true);

			if (wasOpen)
			{
				RefreshLens();
			}
		}

		/// <summary>
		/// Closes the lens when the toolbar drops the menu it was standing in for.
		/// </summary>
		/// <remarks>
		/// A toolbar menu button toggles, so a second click on the lit icon deselects the menu
		/// the lens stands for. Only acts when the lens owns the current menu: one handed back
		/// to vanilla is the vanilla grid's business to close.
		/// </remarks>
		private void VanillaMenuDeselected()
		{
			if (!Mod.Settings.ReplaceVanillaBuildMenu || !_LensOwnsCurrentMenu)
			{
				return;
			}

			// The echo guard compares against the menu last applied. Leaving the
			// old index here would make reopening that same menu look like an echo
			// of a menu that is no longer on screen.
			_appliedMenuIndex = 0;
			_appliedMenuFrame = null;
			_LensOwnsCurrentMenu.Value = false;

			// The same release CloseLens does. A toolbar deselect is a close like any
			// other, and a lens that forgets its menu on only one of the two paths
			// filters by whichever button you happened to use.
			ReleaseMenuScope();

			if (_lensMenuOpen)
			{
				SetLensMenuOpen(false);
			}
		}

		internal void SetLensMenuOpen(bool visible)
		{
			if (_lensMenuOpen == visible)
			{
				return;
			}

			_lensMenuOpen = visible;

			if (!visible)
			{
				return;
			}

			_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();

			RefreshLens();

			// RefreshLens already ran RefreshBuildingCatalog, which refreshes the options
			// bank itself once its facet bindings are current.
		}

		/// <summary>
		/// Closes the menu the lens stands in for when the map selects something new, so the
		/// game draws that selection's panel. See SelectionHandOff.
		/// </summary>
		private void HandSelectionToTheGame()
		{
			var selected = _selectedInfoUISystem.selectedEntity;
			var changed = selected != _lastSelectedEntity;
			_lastSelectedEntity = selected;

			if (SelectionHandOff.ShouldCloseMenu(changed, selected != Entity.Null, _lensMenuOpen, _LensOwnsCurrentMenu.Value))
			{
				CloseLens();
			}
		}
	}
}
