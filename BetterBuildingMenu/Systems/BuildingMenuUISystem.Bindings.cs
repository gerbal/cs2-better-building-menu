using Colossal.Entities;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Drops the "newly unlocked" marks under a menu the lens has taken over.
		/// </summary>
		/// <remarks>
		/// ToolbarUISystem drops <see cref="UIHighlight"/> as the player's asset-category
		/// selection moves off a category; the lens replaces the grid instead of selecting
		/// categories in it, and showing a menu whole means all of them have been seen.
		/// </remarks>
		private void ClearVanillaMenuHighlights(string menuName)
		{
			try
			{
				if (!_indexer.Index.Menus.TryGetMenuEntity(menuName, out var menuEntity)
					|| !EntityManager.TryGetBuffer<Game.Prefabs.UIGroupElement>(menuEntity, true, out var categories))
				{
					return;
				}

				var cleared = 0;

				for (var c = 0; c < categories.Length; c++)
				{
					var category = categories[c].m_Prefab;

					if (EntityManager.TryGetBuffer<Game.Prefabs.UIGroupElement>(category, true, out var assets))
					{
						for (var a = 0; a < assets.Length; a++)
						{
							cleared += Unmark(assets[a].m_Prefab);
						}
					}

					cleared += Unmark(category);
				}

				cleared += Unmark(menuEntity);

				if (cleared > 0)
				{
					RefreshVanillaToolbarBindings();
					Mod.Log.Info($"[UNLOCK-PIP] cleared {cleared} highlight(s) under '{menuName}'");
				}
			}
			catch (Exception ex)
			{
				// A pip that outstays its welcome is not worth failing a menu
				// open over.
				Mod.Log.Warn(ex, $"[UNLOCK-PIP] could not clear highlights under '{menuName}'");
			}
		}

		/// <summary>Removes one highlight, reporting whether there was one.</summary>
		private int Unmark(Entity entity)
		{
			if (entity == Entity.Null || !EntityManager.HasComponent<Game.Prefabs.UIHighlight>(entity))
			{
				return 0;
			}

			EntityManager.RemoveComponent<Game.Prefabs.UIHighlight>(entity);

			return 1;
		}

		/// <summary>
		/// Makes the toolbar redraw after we have removed a highlight.
		/// </summary>
		/// <remarks>
		/// ToolbarUISystem re-binds only on a fresh unlock, so a highlight we drop would sit
		/// on screen; vanilla's UpdateHighlights calls these two private bindings directly.
		/// Cached, and failure is swallowed by the caller: this is cosmetic.
		/// </remarks>
		private void RefreshVanillaToolbarBindings()
		{
			_toolbarGroupsBinding ??= ToolbarField<Colossal.UI.Binding.RawValueBinding>("m_ToolbarGroupsBinding");
			_assetCategoriesBinding ??= ToolbarField<Colossal.UI.Binding.RawMapBinding<Entity>>("m_AssetMenuCategoriesBinding");

			_toolbarGroupsBinding?.Update();
			_assetCategoriesBinding?.UpdateAll();
		}

		/// <summary>A private ToolbarUISystem field, or null once a game update has renamed or retyped it.</summary>
		/// <remarks>Warned about once per field, so the log says why a cleared pip still shows.</remarks>
		private T? ToolbarField<T>(string name) where T : class
		{
			var value = typeof(Game.UI.InGame.ToolbarUISystem)
				.GetField(name, System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
				?.GetValue(_toolbarUISystem) as T;

			if (value is null && _warnedToolbarFields.Add(name))
			{
				Mod.Log.Warn($"[UNLOCK-PIP] ToolbarUISystem.{name} is missing or not a {typeof(T).Name}; a cleared highlight stays drawn until the toolbar next redraws");
			}

			return value;
		}

		private Colossal.UI.Binding.RawValueBinding? _toolbarGroupsBinding;
		private Colossal.UI.Binding.RawMapBinding<Entity>? _assetCategoriesBinding;
		private readonly HashSet<string> _warnedToolbarFields = new();

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

		/// <summary>
		/// Picks one of the scoped menu's category tabs, or all of them.
		/// </summary>
		/// <remarks>
		/// The empty string is "every category in this menu", the state a menu opens in.
		/// Vanilla has no such tab, but the lens can show a whole menu at once.
		/// </remarks>
		private void SetBuildingLensMenuCategory(string category) => Apply(_lens.SelectCategory(category));

		/// <summary>
		/// Narrows the menu to one branch of its service's development tree.
		/// </summary>
		/// <remarks>
		/// The strip's fallback axis. Single-select, like the category and
		/// progression tabs beside it — the strip asks one question per segment.
		/// </remarks>
		private void SetBuildingLensStripTab(string tab) => Apply(_lens.SelectStripTab(tab));


		/// <summary>Narrows the education menu to one school tier.</summary>
		private void SetBuildingLensMenuSchoolTier(int tier) => Apply(_lens.SelectSchoolTier(tier));

		/// <summary>
		/// Scopes the lens to a vanilla menu chosen from the filters.
		/// </summary>
		/// <remarks>
		/// The same state a bottom-bar icon sets, reached the other way, so the view the menu
		/// chip names stays reachable without the shortcut. Deliberately not VanillaMenuSelected:
		/// that one answers the game, this one answers a player already inside the lens.
		/// </remarks>
		private void SetBuildingLensMenu(string menuName) => Apply(_lens.SelectMenu(menuName), navigation: true);

		/// <summary>
		/// Drops the vanilla-menu scope and shows the whole catalog.
		/// </summary>
		/// <remarks>
		/// The bottom-bar icons are shortcuts to a preconfigured view, not a box the player is
		/// locked inside. The facets deliberately survive: this clears the scope, not the
		/// narrowing chosen within it, so one × does one job.
		/// </remarks>
		private void ClearBuildingLensMenuScope() => Apply(_lens.ClearMenuScope(), navigation: true);

		/// <summary>The scope bindings, from the one state that owns them.</summary>
		private void PublishScope()
		{
			_BuildingLensMenuCategoriesBinding.Value = _indexer.Index.GetMenuCategories(
				string.IsNullOrEmpty(_lens.Menu) ? null : _lens.Menu).ToArray();
			_BuildingLensMenuBinding.Value = _lens.Menu;
			_BuildingLensMenusBinding.Value = _indexer.Index.Menus.AssetMenus().ToArray();
			_BuildingLensMenuCategoryBinding.Value = _lens.Category;
			_BuildingLensMenuSchoolTierBinding.Value = _lens.SchoolTier;
			_BuildingLensStripTabBinding.Value = _lens.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
			_CurrentSearch.Value = _lens.SearchText;
		}

		/// <summary>
		/// One trigger's effect: the transition, the bindings that mirror it, the
		/// refresh. A transition that changed nothing (reference-equal) costs
		/// nothing.
		/// </summary>
		private void Apply(BuildingCatalogLensState next, bool navigation = false)
		{
			if (ReferenceEquals(next, _lens))
			{
				return;
			}

			_lens = next;
			PublishScope();

			if (navigation)
			{
				RefreshBuildingLensNavigation();
			}

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Widens a search that found nothing here to the whole catalog.
		/// </summary>
		private void SearchEverything()
		{
			_lens = _lens.ClearMenuScope();
			PublishScope();

			RefreshLens();
		}

		private void SetBuildingLensPanelHeight(float height)
		{
			_BuildingLensPanelHeight.Value = BuildingLensHeight.Clamp(height);
		}

		private void CommitBuildingLensPanelHeight()
		{
			// Only on release, like the width: a drag publishes on every mouse move, and
			// writing the settings file at that rate is what the live binding avoids.
			var height = BuildingLensHeight.Clamp(_BuildingLensPanelHeight);
			if (Math.Abs(Mod.Settings.BuildingLensPanelHeight - height) < 0.1f)
			{
				return;
			}

			Mod.Settings.BuildingLensPanelHeight = height;
			Mod.Settings.ApplyAndSave();
		}

		private void SetBuildingCatalogSortColumn(string column) => Apply(_lens.SetSortColumn(column));

		/// <summary>
		/// Chooses the heading dimension, which is also the query's primary key.
		/// </summary>
		/// <remarks>
		/// The window shrinks back to the base chunk because grouping reorders the whole result.
		/// Returns early when nothing changed: the UI derives this value from the menu, so it
		/// re-sends it on every menu open.
		/// </remarks>
		private void SetBuildingCatalogGroupBy(string groupBy) => Apply(_lens.SetGroupBy(groupBy));

		/// <remarks>Same idempotence guard as the group-by above.</remarks>
		private void SetBuildingCatalogSortDescending(bool descending) => Apply(_lens.SetDescending(descending));

		/// <summary>
		/// Grows the window to the limit the UI asked for, by one step at most, keeping the
		/// offset at zero. A repeated request changes nothing; see LoadMoreTo.
		/// </summary>
		/// <remarks>
		/// The window is owned here rather than accumulated on the client, because placing a
		/// building unmounts the panel. A bigger Limit over the same predicates returns a longer
		/// prefix of the same order, so the rows on screen keep their identity.
		/// </remarks>
		private void LoadMoreBuildingCatalog(int requestedLimit) => Apply(_lens.LoadMoreTo(requestedLimit));

		private void ToggleBuildingLensFacet(string facetId, string optionId) => Apply(_lens.ToggleFacet(facetId, optionId));

		/// <summary>
		/// Puts a menu back the way it opens.
		/// </summary>
		/// <remarks>
		/// Clear drops only the facets; a menu also accumulates a strip tab, a school level, a
		/// search and a sort, and this is the one gesture back to a known state. Grouping and
		/// view mode are UI-side choices, so the pane clears its own alongside this.
		/// </remarks>
		private void ResetBuildingLensMenu() => Apply(_lens.ResetMenu());

		private void ClearBuildingLensFilters() => Apply(_lens.ClearFilters());

		private void SetBuildingCatalogMetricRange(string metricId, string minText, string maxText) =>
			Apply(_lens.SetMetricRange(metricId, minText, maxText));

		private void ClearBuildingCatalogMetricRanges() => Apply(_lens.ClearMetricRanges());

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
		/// Takes the game's own toolbar filter row and applies it to the catalog.
		/// </summary>
		/// <remarks>
		/// The rule is <see cref="VanillaToolbarFilter"/>, transcribed from ToolbarUISystem and
		/// tested against it. All this does is deliver the selection and ask for a redraw.
		/// </remarks>
		private void SetVanillaToolbarSelection(string themes, string packs, bool vanillaSelected, bool modsSelected)
		{
			_toolbarSelection = new VanillaToolbarSelection(
				ParseEntityIndices(themes),
				ParseEntityIndices(packs),
				vanillaSelected,
				modsSelected);

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// "11,22" to [11, 22]. Empty and malformed both mean "nothing selected".
		/// </summary>
		/// <remarks>
		/// Silently skipping a value that will not parse is deliberate: the
		/// alternative is throwing inside a UI trigger, and a filter that cannot
		/// read one entity index should narrow the menu rather than break it.
		/// </remarks>
		private static int[] ParseEntityIndices(string? joined)
		{
			if (joined?.Trim() is not { Length: > 0 })
			{
				return Array.Empty<int>();
			}

			var parts = joined.Split(',');
			var indices = new List<int>(parts.Length);

			foreach (var part in parts)
			{
				if (int.TryParse(part, out var index))
				{
					indices.Add(index);
				}
			}

			return indices.ToArray();
		}


		private void SearchChanged(string text)
		{
			var next = _lens.Search(text);

			if (ReferenceEquals(next, _lens))
			{
				return;
			}

			_lens = next;
			_CurrentSearch.Value = _lens.SearchText;
			_CurrentSearch.ForceUpdate();
			TriggerSearch();
		}
	}
}
