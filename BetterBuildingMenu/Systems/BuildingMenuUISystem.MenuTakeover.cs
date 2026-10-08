using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
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

			_assetMenu = _assetMenu.SelectMenu(menuName);
			// The player is now looking at everything this menu holds, which is
			// what vanilla treats as having seen it.
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

			if (!visible)
			{
				// A close is a moment the player is not placing: keep what they placed.
				_placementWatch.FlushIfDirty();
				return;
			}

			_AssetMenuWidth.Value = GridUtil.GetCurrentAssetMenuWidth();

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
