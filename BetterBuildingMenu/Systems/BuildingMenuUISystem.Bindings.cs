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
		/// The green pip on a toolbar button is <see cref="UIHighlight"/>, which
		/// ToolbarUISystem writes as each item's "highlight" property.
		/// UpdateHighlights removes it when the player's ASSET CATEGORY selection
		/// moves off a category: it clears that category's assets, then the
		/// category, then the menu once nothing under it is still marked.
		///
		/// That path runs off m_SelectedAssetCategoryBinding, and the lens
		/// replaces the vanilla grid rather than selecting categories in it — so
		/// the game never saw the player look, and the pip on Roads and Zones
		/// stayed lit forever.
		///
		/// The lens shows a menu's whole contents at once rather than one
		/// category at a time, so viewing it means all of them have been seen.
		/// Vanilla's theme and asset-pack conditions are deliberately not
		/// reproduced: those decide which assets a CATEGORY still owes a mark
		/// to, and there is no partially-viewed category here.
		/// </remarks>
		private void ClearVanillaMenuHighlights(string menuName)
		{
			try
			{
				if (!PrefabIndexingSystem.TryGetAssetMenuEntity(menuName, out var menuEntity)
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
		/// Removing the component is not enough on its own. ToolbarUISystem only
		/// re-binds when a prefab was newly unlocked this frame or a unique
		/// asset changed state, so a highlight we drop would sit on screen until
		/// the next unlock. Vanilla's own UpdateHighlights answers this by
		/// calling these two bindings directly; they are private, so we reach
		/// them the way PdxModsUtil reaches m_SDKContext.
		///
		/// Cached, and failure is swallowed by the caller: this is cosmetic, and
		/// a field rename in a game patch must not take the menu down with it.
		/// </remarks>
		private void RefreshVanillaToolbarBindings()
		{
			_toolbarGroupsBinding ??= typeof(Game.UI.InGame.ToolbarUISystem)
				.GetField("m_ToolbarGroupsBinding", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
				?.GetValue(_toolbarUISystem);
			_assetCategoriesBinding ??= typeof(Game.UI.InGame.ToolbarUISystem)
				.GetField("m_AssetMenuCategoriesBinding", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
				?.GetValue(_toolbarUISystem);

			(_toolbarGroupsBinding as Colossal.UI.Binding.RawValueBinding)?.Update();
			(_assetCategoriesBinding as Colossal.UI.Binding.RawMapBinding<Entity>)?.UpdateAll();
		}

		private object _toolbarGroupsBinding;
		private object _assetCategoriesBinding;

		/// <summary>
		/// Closes the lens and, when it was standing in for a vanilla menu,
		/// releases that menu's selection on the toolbar.
		/// </summary>
		/// <remarks>
		/// Closing the panel used to leave the toolbar button still selected,
		/// because the game never learned the menu went away. The next press of
		/// that button was therefore read as "deselect", which does nothing
		/// visible, and the lens only came back on the second click.
		///
		/// A previous attempt fixed the same symptom by suppressing the vanilla
		/// grid, which traded the extra click for a worse one. Clearing the
		/// selection tells the game the truth instead.
		///
		/// Only the deliberate close paths call this. When the player picks a
		/// different vanilla menu the lens also closes, but there the selection
		/// is their new choice and clearing it would undo the click — that path
		/// arms a tool, so it never reaches OnToolChanged's default-tool branch.
		///
		/// Notably NOT called from OnToolChanged. That branch fires on every
		/// return to the default tool, so clearing the selection there released
		/// the menu long before the player pressed Escape — and the game's own
		/// Escape chain, finding nothing left to close, opened the pause menu.
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
		/// The scope was set on every vanilla menu click and, before this
		/// existed, cleared in only one of the two places the lens closes:
		/// reopening from FindIt's own toolbar button still filtered the whole
		/// catalog down to whichever menu had been clicked last, with nothing on
		/// screen saying so.
		///
		/// Shared rather than duplicated because the two close paths had already
		/// drifted apart once — CloseLens cleared the scope and
		/// VanillaMenuDeselected did not, so which stale filter you got depended
		/// on whether you closed the lens with its own button or with the
		/// toolbar icon.
		/// </remarks>
		private void ReleaseMenuScope()
		{
			_lens = _lens.ClearMenuScope();
			PublishScope();
		}

		/// <summary>
		/// A vanilla toolbar menu was opened: show the lens filtered to it.
		/// </summary>
		/// <remarks>
		/// Declines quietly whenever the lens has nothing better to offer than
		/// the vanilla grid — the setting is off, or the menu has no name in
		/// the index (a modded toolbar entry added after indexing) — so the
		/// vanilla menu keeps working untouched in those cases. Every named
		/// vanilla menu routes here, Roads and Landscaping included.
		/// </remarks>
		/// <summary>
		/// Hand this menu back to vanilla: we do not own it, and nothing of
		/// ours is left covering it.
		/// </summary>
		/// <remarks>
		/// Three callers used to write these three lines out, and a fourth —
		/// the ReplaceVanillaBuildMenu-is-off branch — wrote only the first two
		/// and returned. That single missing line was the ONLY way the retired
		/// floating panel could still reach the screen: turn the setting off
		/// mid-session and select a menu, and ShowFindItPanel stayed true while
		/// LensOwnsCurrentMenu went false, which is exactly the combination
		/// shouldMountLegacyPanel draws on.
		///
		/// Worse, that panel could then be made permanent. SetLensMenuOpen
		/// early-returns on (_IsWindowLocked and _lensMenuOpen), so one click
		/// of its lock button refused every close path there is.
		///
		/// A shape written out four times will diverge; this is the divergence.
		/// One method so the next caller cannot repeat it.
		/// </remarks>
		private void YieldMenuToVanilla()
		{
			_LensOwnsCurrentMenu.Value = false;

			if (_lensMenuOpen)
			{
				SetLensMenuOpen(false);
			}
		}

		private void VanillaMenuSelected(int menuEntityIndex)
		{
			if (!Mod.Settings.ReplaceVanillaBuildMenu)
			{
				YieldMenuToVanilla();
				return;
			}

			// Opening the lens makes the game re-assert the armed tool's menu,
			// so one click arrives as two selections. Routing the second
			// reverted the player's choice within the same tick.
			if (MenuEchoGuard.IsEcho(_appliedMenuFrame, _appliedMenuIndex, UnityEngine.Time.frameCount, menuEntityIndex))
			{
				return;
			}

			// The menu's own name is the whole constraint the query needs:
			// assets carry the menu the game placed them in (PrefabIndex.UiMenuName,
			// read off UIObject.m_Group), so a name reproduces vanilla's set
			// exactly. GetAssetMenuName resolves the UIAssetMenuPrefab's name,
			// which is that same string, so it needs no translation. There used
			// to be a preset table in front of this that mapped the service
			// menus onto upstream FindIt's category enums; the tree covers every
			// menu — Roads alone is 9 categories, 157 assets — so the table only
			// ever narrowed what the tree already answered.
			var menuName = PrefabIndexingSystem.GetAssetMenuName(menuEntityIndex);

			if (string.IsNullOrEmpty(menuName))
			{
				// A menu the index never saw — a modded toolbar entry that was
				// added after indexing, or one with no prefab. The player asked
				// for that menu, so get out of its way: the lens panel sits over
				// exactly where the vanilla asset grid appears, and leaving it up
				// would hide the menu they just clicked.
				YieldMenuToVanilla();
				return;
			}

			_lens = _lens.SelectMenu(menuName);
			// The player is now looking at everything this menu holds, which is
			// what vanilla treats as having seen it.
			ClearVanillaMenuHighlights(menuName);
			PublishScope();
			// A different menu has different tabs, so the old selection cannot
			// survive the switch.

			_appliedMenuIndex = menuEntityIndex;
			_appliedMenuFrame = UnityEngine.Time.frameCount;
			_LensOwnsCurrentMenu.Value = true;

			// Opening a menu never arms a prefab. Re-arming the prefab from the
			// LAST menu is what desynced the toolbar (the old SelectPrefabOnOpen
			// option, now gone, tried to do exactly that). Arming a
			// water pipe makes the game re-assert Water as the selected menu, so
			// the highlight sat on Water while the lens showed Electricity, and
			// clicking the lit Water icon closed a menu the player never opened.
			//
			// The echo guard was written for the same re-assertion and only
			// stopped it reaching US; the game's own selection still moved. This
			// removes the re-assertion instead of ignoring it.
			//
			// Exactly one refresh, whichever way we got here.
			//
			// SetLensMenuOpen(true) ends in RefreshLens — but it FIRST
			// early-returns when the panel is already visible, which is
			// precisely the menu-to-menu switch. So the refresh cannot live
			// only inside the toggle (a switch would get none) and cannot
			// live only outside it (a cold open would get two).
			//
			// Measured both ways: three refreshes fired per open before
			// this, and dropping the outside pair silently left the strip
			// showing the PREVIOUS menu's counts on every switch.
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
		/// A toolbar menu button toggles: clicking the one that is already open
		/// deselects it. The lens only ever heard about the opening half of that,
		/// so a second click on the same icon un-lit the button, closed the menu it
		/// stood for, and left the panel covering the screen with no way to read it
		/// as anything but stuck.
		///
		/// Only acts when the lens owns the current menu. A menu that was
		/// handed back to vanilla (see VanillaMenuSelected) is the vanilla
		/// grid's business to close, not ours.
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

			// The same release CloseLens does. The toolbar deselect is a close
			// like any other, and a lens that forgets its menu only when closed
			// one of the two ways is a lens whose next filter depends on which
			// button you used.
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
		/// The empty string is "every category in this menu", which is the state
		/// a menu opens in. Vanilla has no such tab — it always opens on the
		/// first category — but the lens can show a whole menu at once and that
		/// is worth keeping, so the strip carries one more option than vanilla's.
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
		/// The same state a bottom-bar icon sets, reached the other way. If a
		/// toolbar icon is a shortcut to a preconfigured view — which is what
		/// the menu chip says it is — then the view has to be reachable without
		/// the shortcut, or the chip names something only the toolbar can
		/// produce.
		///
		/// Deliberately not VanillaMenuSelected. That one is answering the game
		/// ("the player opened this menu, get out of its way or take it over"),
		/// so it carries an echo guard and two branches that close the panel.
		/// This one is answering the player, who is already in the lens and has
		/// just asked for a menu inside it.
		/// </remarks>
		private void SetBuildingLensMenu(string menuName) => Apply(_lens.SelectMenu(menuName), navigation: true);

		/// <summary>
		/// Drops the vanilla-menu scope and shows the whole catalog.
		/// </summary>
		/// <remarks>
		/// The bottom-bar icons are shortcuts to a preconfigured view, not a box
		/// the player is locked inside. Removing the menu chip is how you say
		/// "same filters, everything" — the widening that SearchEverything only
		/// offered for a search that already found nothing.
		///
		/// The facets deliberately survive. This clears the scope, not the
		/// narrowing the player chose within it, and dropping both would make
		/// one × do two jobs.
		/// </remarks>
		private void ClearBuildingLensMenuScope() => Apply(_lens.ClearMenuScope(), navigation: true);

		/// <summary>
		/// Republishes the tab strip for whatever menu is currently scoped.
		/// </summary>
		/// <summary>The scope bindings, from the one state that owns them.</summary>
		private void PublishScope()
		{
			_BuildingLensMenuCategoriesBinding.Value = PrefabIndexingSystem.GetMenuCategories(
				string.IsNullOrEmpty(_lens.Menu) ? null : _lens.Menu).ToArray();
			_BuildingLensMenuBinding.Value = _lens.Menu;
			_BuildingLensMenusBinding.Value = PrefabIndexingSystem.GetAssetMenus().ToArray();
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
			// Only on release, like the width: a drag publishes on every mouse
			// move, and writing the settings file at that rate is what the live
			// binding exists to avoid.
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
		/// The window shrinks back to the base chunk because the grouping
		/// reorders the whole result: the rows the player grew the window to
		/// reach are not the rows that would come back.
		/// </remarks>
		/// <remarks>
		/// Returns early when nothing changed, like ToggleBuildingLensFacet
		/// below. Not a micro-optimisation: the UI derives this value from the
		/// menu, so it re-sends it on EVERY menu open — measured at a full
		/// query and a republish of a dozen bindings per open, for a value that
		/// was already what it is. Three refreshes fired per menu open and this
		/// was one of them.
		/// </remarks>
		private void SetBuildingCatalogGroupBy(string groupBy) => Apply(_lens.SetGroupBy(groupBy));

		/// <remarks>Same idempotence guard as the group-by above.</remarks>
		private void SetBuildingCatalogSortDescending(bool descending) => Apply(_lens.SetDescending(descending));

		/// <summary>
		/// Grows the window by one step, keeping the offset at zero.
		/// </summary>
		/// <remarks>
		/// The window is owned here rather than accumulated on the client
		/// because placing a building unmounts the lens panel, which would take
		/// any client-side list of rows with it. A bigger Limit over the same
		/// predicates re-runs the order across the whole match set and returns a
		/// longer prefix of it, so the rows already on screen keep their
		/// identity and there is no seam to stitch.
		/// </remarks>
		private void LoadMoreBuildingCatalog() => Apply(_lens.LoadMore());

		private void ToggleBuildingLensFacet(string facetId, string optionId) => Apply(_lens.ToggleFacet(facetId, optionId));

		/// <summary>
		/// Same toggle the filter rail uses, exposed for the options bank's
		/// short-facet sections (see <see cref="Domain.Options.BuildingLensFacetOptionBase"/>).
		/// </summary>
		public void ToggleBuildingLensFacetOption(string facetId, string optionId) =>
			ToggleBuildingLensFacet(facetId, optionId);

		private void ClearBuildingLensFacets() => Apply(_lens.ClearFacets());

		/// <summary>
		/// Puts a menu back the way it opens.
		/// </summary>
		/// <remarks>
		/// Clear only drops the FACETS. A menu accumulates more than that — a
		/// tab in the strip, a school level, a search, a sort — and undoing them
		/// meant finding each control and remembering what it had been. This is
		/// the one gesture that gets back to a known state.
		///
		/// The grouping and the view mode are not here: they are UI-side
		/// choices, kept per lens rather than in the query, so the pane clears
		/// its own alongside this call.
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

			// RefreshLens already ran RefreshBuildingCatalog
			// above, which now refreshes the options bank itself once its facet
			// bindings are current. A second call here would just repeat that
			// with nothing having changed in between.
		}

		/// <summary>
		/// Takes the game's own toolbar filter row and applies it to the catalog.
		/// </summary>
		/// <remarks>
		/// Closes cm-2xvs.3. The toolbar's EU/NA toggle, its asset packs and its
		/// Vanilla/Mods buttons filtered the vanilla grid and did nothing to the
		/// lens, because the lens replaced the menu below them and not the row
		/// itself.
		///
		/// The rule is <see cref="VanillaToolbarFilter"/>, transcribed from
		/// ToolbarUISystem and tested against it. All this does is deliver the
		/// selection and ask for a redraw.
		/// </remarks>
		private void SetVanillaToolbarSelection(string themes, string packs, bool vanillaSelected, bool modsSelected)
		{
			var selection = new VanillaToolbarSelection(
				ParseEntityIndices(themes),
				ParseEntityIndices(packs),
				vanillaSelected,
				modsSelected);

			BuildingCatalogAdapter.ToolbarSelection = selection;

			// The zone catalog is a separate list built by the indexer, so it
			// carries its own copy of the same rule rather than sharing this
			// query. Republishing it here keeps the two surfaces agreeing about
			// what the toolbar is currently hiding.

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
			if (string.IsNullOrWhiteSpace(joined))
			{
				return Array.Empty<int>();
			}

			var parts = joined!.Split(',');
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

		private void OnLocateButtonClicked(int id)
		{
			var entities = PrefabTrackingSystem.GetPlacedEntities(id);
			_interactionBoundary.TryLocate(id, entities.Count, index => JumpTo(entities[index]));
		}

		private void JumpTo(Entity entity)
		{
			if (_cameraUpdateSystem.orbitCameraController != null && entity != Entity.Null)
			{
				_cameraUpdateSystem.orbitCameraController.followedEntity = entity;
				_cameraUpdateSystem.orbitCameraController.TryMatchPosition(_cameraUpdateSystem.activeCameraController);
				_cameraUpdateSystem.activeCameraController = _cameraUpdateSystem.orbitCameraController;
			}
		}
	}
}
