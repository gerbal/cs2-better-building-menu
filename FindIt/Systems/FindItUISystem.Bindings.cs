using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using FindItBuildingMenu.Utilities;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

using Unity.Entities;

namespace FindItBuildingMenu.Systems
{
    internal partial class FindItUISystem : ExtendedUISystemBase
	{
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

			ToggleFindItPanel(false);

			// The window lock refuses the close, so the menu is still on screen.
			if (_ShowFindItPanel)
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
			_buildingLensUiMenu = string.Empty;
			_buildingLensUiCategory = string.Empty;
			ResetBuildingLensMilestone();
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();
			RefreshBuildingLensMenuCategories();
		}

		private void SetCurrentCategory(int category)
		{
			FindItUtil.CurrentCategory = (PrefabCategory)category;

			_CurrentSubCategoryBinding.Value = (int)PrefabSubCategory.Any;

			SetCurrentSubCategory((int)PrefabSubCategory.Any);
		}

		/// <summary>
		/// A vanilla toolbar menu was opened: show the lens filtered to it.
		/// </summary>
		/// <remarks>
		/// Declines quietly whenever the lens has nothing better to offer than
		/// the vanilla grid — the setting is off, the menu is Roads or
		/// Landscaping, or it is a modded menu we have no preset for — so the
		/// vanilla menu keeps working untouched in all those cases.
		/// </remarks>
		private void VanillaMenuSelected(int menuEntityIndex)
		{
			if (!Mod.Settings.ReplaceVanillaBuildMenu)
			{
				_LensOwnsCurrentMenu.Value = false;
				_LensMenuToolTip.Value = string.Empty;
				return;
			}

			// Opening the lens makes the game re-assert the armed tool's menu,
			// so one click arrives as two selections. Routing the second
			// reverted the player's choice within the same tick.
			if (MenuEchoGuard.IsEcho(_appliedMenuFrame, _appliedMenuIndex, UnityEngine.Time.frameCount, menuEntityIndex))
			{
				return;
			}

			var menuName = PrefabIndexingSystem.GetAssetMenuName(menuEntityIndex);
			var preset = VanillaMenuPresets.Resolve(menuName);

			// SPIKE (cm-e98i). The menu's own name is the whole constraint the
			// query needs: assets carry the menu the game placed them in, so a
			// name is enough to reproduce vanilla's set exactly. Set before the
			// preset check, because a menu with no preset is precisely the case
			// the tree rescues.
			// GetAssetMenuName resolves the UIAssetMenuPrefab's name, which is the
			// same string assets carry as UiMenu, so it needs no translation.
			_buildingLensUiMenu = menuName ?? string.Empty;
			// A different menu has different tabs, so the old selection cannot
			// survive the switch.
			_buildingLensUiCategory = string.Empty;
			ResetBuildingLensMilestone();
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();
			RefreshBuildingLensMenuCategories();

			// SPIKE (cm-e98i): Roads, Landscaping and Areas resolve to no preset
			// and used to close the panel — the lens simply could not show them.
			// The tree covers them (Roads alone is 9 categories, 157 assets), so
			// when it knows the menu, open the lens on it instead of retreating.
			if (preset is null && !string.IsNullOrEmpty(_buildingLensUiMenu))
			{
				_appliedMenuIndex = menuEntityIndex;
				_appliedMenuFrame = UnityEngine.Time.frameCount;
				_LensOwnsCurrentMenu.Value = true;
						_buildingLensSection = VanillaBuildMenuTaxonomy.AllBuildings;
				_buildingLensSubCategory = VanillaBuildMenuTaxonomy.Any;
				_BuildingLensSectionBinding.Value = _buildingLensSection;
				_BuildingLensSubCategoryBinding.Value = _buildingLensSubCategory;
				_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };
	
				// activatePrefab: false. Opening a menu must not re-arm the prefab
				// from the LAST menu — that is what desynced the toolbar. Arming a
				// water pipe makes the game re-assert Water as the selected menu, so
				// the highlight sat on Water while the lens showed Electricity, and
				// clicking the lit Water icon closed a menu the player never opened.
				//
				// The echo guard was written for the same re-assertion and only
				// stopped it reaching US; the game's own selection still moved. This
				// removes the re-assertion instead of ignoring it.
				ToggleFindItPanel(true, activatePrefab: false);
				RefreshBuildingLensNavigation();
				RefreshBuildingCatalog();
				return;
			}

			if (preset is null)
			{
				// Roads, Landscaping, Areas, or a modded menu. The player asked
				// for that menu, so get out of its way: the lens panel sits over
				// exactly where the vanilla asset grid appears, and leaving it up
				// would hide the menu they just clicked.
				_LensOwnsCurrentMenu.Value = false;
				_LensMenuToolTip.Value = string.Empty;

				if (_ShowFindItPanel)
				{
					ToggleFindItPanel(false);
				}

				return;
			}

			_appliedMenuIndex = menuEntityIndex;
			_appliedMenuFrame = UnityEngine.Time.frameCount;

			if (preset.IsZoning && !Mod.Settings.ReplaceVanillaZonesMenu)
			{
				// The player kept the familiar zone grid; leave it alone and get
				// out of its way, exactly as for an unmapped menu.
				_LensOwnsCurrentMenu.Value = false;
				_LensMenuToolTip.Value = string.Empty;

				if (_ShowFindItPanel)
				{
					ToggleFindItPanel(false);
				}

				return;
			}

			_LensOwnsCurrentMenu.Value = true;
			_LensMenuToolTip.Value = PrefabIndexingSystem.GetAssetMenuToolTip(menuEntityIndex) ?? string.Empty;


			// With the lens enabled RefreshBuildingCatalog deliberately ignores
			// FindItUtil's category and reads the lens's own section and
			// subcategory instead, so the preset has to be applied there.
			var section = preset.Category switch
			{
				PrefabCategory.ServiceBuildings => VanillaBuildMenuTaxonomy.ServiceBuildings,
				PrefabCategory.Networks => VanillaBuildMenuTaxonomy.Networks,
				_ => VanillaBuildMenuTaxonomy.AllBuildings,
			};
			var selection = VanillaBuildMenuSelection.Normalize(
				section,
				preset.SubCategory == PrefabSubCategory.Any
					? VanillaBuildMenuTaxonomy.Any
					: preset.SubCategory.ToString());

			_buildingLensSection = selection.Section;
			_buildingLensSubCategory = selection.SubCategory;
			_BuildingLensSectionBinding.Value = _buildingLensSection;
			_BuildingLensSubCategoryBinding.Value = _buildingLensSubCategory;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };


			ToggleFindItPanel(true, activatePrefab: false);
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
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
		/// Only acts when the lens owns the current menu. Roads and Landscaping
		/// hand the screen back to vanilla (see VanillaMenuSelected), and their
		/// deselection is the vanilla grid's business, not ours.
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

			if (_ShowFindItPanel)
			{
				ToggleFindItPanel(false);
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
		private void SetBuildingLensMenuCategory(string category)
		{
			// The zoning view is not the building catalog: it renders the zone
			// catalog narrowed by family, and reads none of the query the
			// category scope feeds. So the strip's five Zones tabs — which are
			// the five families, under the game's own plural names — were a row
			// of buttons that took the selected treatment and changed nothing on
			// screen, while the "All families" picker beside them worked.
			//
			// Both now write the one selection. The strip picks a single family
			// because a tab strip is single-select; the picker still composes
			// several, and whichever set that leaves is what both controls read
			// back.
			_buildingLensUiCategory = category ?? string.Empty;
			_BuildingLensMenuCategoryBinding.Value = _buildingLensUiCategory;
			// A new category resets the tier. The tabs are a subset of the
			// category, so a tier held across a category change is a narrowing
			// the player made against a set that is no longer on screen — and
			// on the categories that hold no assets from it, an empty menu with
			// no visible cause.
			ResetBuildingLensMilestone();
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			RefreshBuildingCatalog();
		}


		/// <summary>
		/// Narrows the menu to one tier of the game's progression.
		/// </summary>
		/// <remarks>
		/// A single index, or <see cref="BuildingCatalogQuery.AnyMilestone"/> for
		/// the whole menu — the tab strip is single-select, the same as the
		/// category strip beside it.
		///
		/// The tier is a property of the ASSET, not of the save: it is the point
		/// the game gates the asset behind, and it stays that after the player
		/// has passed it. This is why the strip is worth drawing in a developed
		/// city, where every tab is unlocked and the tiers are the only thing
		/// still telling one era of the menu from another.
		/// </remarks>
		private void SetBuildingLensMenuMilestone(int milestone)
		{
			_buildingLensUnlockMilestone = milestone < 0
				? BuildingCatalogQuery.AnyMilestone
				: milestone;
			_BuildingLensMenuMilestoneBinding.Value = _buildingLensUnlockMilestone;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			RefreshBuildingCatalog();
		}

		/// <summary>Drops the tier narrowing, without refreshing on its own.</summary>
		/// <remarks>
		/// Every caller is already on its way to <c>RefreshBuildingCatalog</c>
		/// for a scope change of its own, so refreshing here would run the query
		/// twice for one gesture.
		/// </remarks>
		private void ResetBuildingLensMilestone()
		{
			_buildingLensUnlockMilestone = BuildingCatalogQuery.AnyMilestone;
			_BuildingLensMenuMilestoneBinding.Value = _buildingLensUnlockMilestone;
		}

		/// <summary>
		/// Narrows the menu to one branch of its service's development tree.
		/// </summary>
		/// <remarks>
		/// The strip's fallback axis. Single-select, like the category and
		/// progression tabs beside it — the strip asks one question per segment.
		/// </remarks>
		private void SetBuildingLensStripTab(string tab)
		{
			// A branch and a category are ALTERNATIVES wherever the strip draws
			// branches in a category's place — the same rule the school levels
			// follow. Holding a category as well would intersect Administration
			// with a police branch and empty the menu.
			_buildingLensUiCategory = string.Empty;
			_BuildingLensMenuCategoryBinding.Value = _buildingLensUiCategory;
			_buildingLensStripTab = tab ?? string.Empty;
			_BuildingLensStripTabBinding.Value = _buildingLensStripTab;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			RefreshBuildingCatalog();
		}

		/// <summary>Drops the strip narrowing, without refreshing on its own.</summary>
		/// <remarks>Same contract as ResetBuildingLensMilestone above.</remarks>
		private void ResetBuildingLensStripTab()
		{
			_buildingLensStripTab = string.Empty;
			_BuildingLensStripTabBinding.Value = _buildingLensStripTab;
		}

		/// <summary>Narrows the education menu to one school tier.</summary>
		private void SetBuildingLensMenuSchoolTier(int tier)
		{
			// A level and a category are ALTERNATIVES: the strip draws the four
			// levels in the Education category's own place, so picking one is
			// picking that category, more narrowly. Holding a previously picked
			// category as well would intersect Research with a school level and
			// empty the menu.
			_buildingLensUiCategory = string.Empty;
			_BuildingLensMenuCategoryBinding.Value = _buildingLensUiCategory;
			_buildingLensSchoolTier = tier < 0 ? -1 : tier;
			_BuildingLensMenuSchoolTierBinding.Value = _buildingLensSchoolTier;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			RefreshBuildingCatalog();
		}

		/// <summary>Drops the tier narrowing, without refreshing on its own.</summary>
		private void ResetBuildingLensSchoolTier()
		{
			_buildingLensSchoolTier = -1;
			_BuildingLensMenuSchoolTierBinding.Value = _buildingLensSchoolTier;
		}

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
		private void SetBuildingLensMenu(string menuName)
		{
			if (string.IsNullOrWhiteSpace(menuName))
			{
				ClearBuildingLensMenuScope();
				return;
			}

			_buildingLensUiMenu = menuName.Trim();
			// A different menu has different tabs, so the old selection cannot
			// survive the switch — same reason as VanillaMenuSelected.
			_buildingLensUiCategory = string.Empty;
			ResetBuildingLensMilestone();
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			// Zones are assignment tools rather than buildings, so that menu gets
			// the zoning hierarchy. ReplaceVanillaZonesMenu is not consulted:
			// that setting decides whether we take the vanilla menu over when the
			// player clicks its toolbar icon, and this is the player asking for
			// our view from inside our panel.
			bool zoning = VanillaMenuPresets.Resolve(_buildingLensUiMenu)?.IsZoning == true;

			if (zoning)
			{
			}


			RefreshBuildingLensMenuCategories();
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}

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
		private void ClearBuildingLensMenuScope()
		{
			_buildingLensUiMenu = string.Empty;
			_buildingLensUiCategory = string.Empty;
			ResetBuildingLensMilestone();
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();

			// The section and subcategory go too, because the MENU set them, not
			// the player. VanillaMenuSelected applies all four together when a
			// toolbar icon is clicked — Roads arrives as scope "Roads" AND
			// section "Networks" — so clearing only the first two left a
			// narrowing nobody chose: the chips read "All menus / Networks /
			// All types" and the catalog showed a third of itself while
			// claiming to show everything. That is cm-2xvs.2, whose original
			// route in (reopening from FindIt's own toolbar button) went with
			// the magnifier; this one survived it.
			//
			// The facets still deliberately survive, and that distinction is the
			// point: the filter rail holds what the player picked, and one × has
			// no business undoing that as well. This undoes exactly what
			// selecting the menu applied.
			VanillaBuildMenuSelection widened = VanillaBuildMenuSelection.Normalize(
				VanillaBuildMenuTaxonomy.AllBuildings,
				VanillaBuildMenuTaxonomy.Any);

			_buildingLensSection = widened.Section;
			_buildingLensSubCategory = widened.SubCategory;
			_BuildingLensSectionBinding.Value = _buildingLensSection;
			_BuildingLensSubCategoryBinding.Value = _buildingLensSubCategory;
			FindItUtil.CurrentCategory = PrefabCategory.Any;
			FindItUtil.CurrentSubCategory = PrefabSubCategory.Any;

			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			// The zoning view is a different renderer over a different catalog,
			// so leaving it scoped to zones while the query widens would show
			// the player zones and tell them "all menus". Send them to the
			// catalog, which is what "everything" means here.

			RefreshBuildingLensMenuCategories();
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Republishes the tab strip for whatever menu is currently scoped.
		/// </summary>
		private void RefreshBuildingLensMenuCategories()
		{
			var tabs = PrefabIndexingSystem.GetMenuCategories(
				string.IsNullOrEmpty(_buildingLensUiMenu) ? null : _buildingLensUiMenu);

			_BuildingLensMenuCategoriesBinding.Value = tabs.ToArray();
			_BuildingLensMenuBinding.Value = _buildingLensUiMenu;
			_BuildingLensMenusBinding.Value = PrefabIndexingSystem.GetAssetMenus().ToArray();

			_BuildingLensMenuCategoryBinding.Value = _buildingLensUiCategory;
			_BuildingLensMenuMilestoneBinding.Value = _buildingLensUnlockMilestone;
			_BuildingLensStripTabBinding.Value = _buildingLensStripTab;
		}

		/// <summary>
		/// Widens a search that found nothing here to the whole catalog.
		/// </summary>
		private void SearchEverything()
		{
			VanillaBuildMenuSelection selection = VanillaBuildMenuSelection.Normalize(
				VanillaBuildMenuTaxonomy.AllBuildings,
				VanillaBuildMenuTaxonomy.Any);

			_buildingLensSection = selection.Section;
			_buildingLensSubCategory = selection.SubCategory;
			// The menu scope has to go too, or "search everything" searches the
			// one menu the player already knows has nothing. Widening the
			// section alone left MatchesVanillaMenuTree still filtering every
			// candidate down to that menu, so the control that exists to escape
			// an empty result could not escape it.
			ReleaseMenuScope();
			_BuildingLensSectionBinding.Value = _buildingLensSection;
			_BuildingLensSubCategoryBinding.Value = _buildingLensSubCategory;
			FindItUtil.CurrentCategory = PrefabCategory.Any;
			FindItUtil.CurrentSubCategory = PrefabSubCategory.Any;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };


			RefreshBuildingLensNavigation();
			RefreshLens();
			RefreshBuildingCatalog();
		}

		private void SetCurrentSubCategory(int category)
		{
			FindItUtil.CurrentSubCategory = (PrefabSubCategory)category;


			RefreshLens();

			if (FindItUtil.Filters.GetFilterList().Any()) // Check if there are any active filters
			{
				// Trigger the delayed search instead of refreshing the list immediately

				TriggerSearch();
			}

			// RefreshLens already ran RefreshBuildingCatalog
			// above, which now refreshes the options bank itself once its facet
			// bindings are current. A second call here would just repeat that
			// with nothing having changed in between.
		}

		private void SetBuildingLensSection(string section)
		{
			// The zoning hierarchy is armed by the vanilla Zones menu and was
			// never disarmed by anything else, so choosing a building section
			// left the zone tiles on screen under a breadcrumb that read
			// "Buildings" and a count of 3,667. Only the interception path could
			// see this before; the section picker made it reachable.

			VanillaBuildMenuSelection selection = VanillaBuildMenuSelection.Normalize(section, VanillaBuildMenuTaxonomy.Any);
			_buildingLensSection = selection.Section;
			_buildingLensSubCategory = selection.SubCategory;
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Offset = 0,
				Limit = BuildingCatalogQuery.DefaultLimit,
				MinCapacity = null,
			};
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}

		private void SetBuildingLensSubCategory(string subCategory)
		{
			VanillaBuildMenuSelection selection = VanillaBuildMenuSelection.Normalize(_buildingLensSection, subCategory);
			_buildingLensSection = selection.Section;
			_buildingLensSubCategory = selection.SubCategory;
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Offset = 0,
				Limit = BuildingCatalogQuery.DefaultLimit,
				MinCapacity = null,
			};
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
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

		private void ToggleBuildingCatalogCompare(int id)
		{
			_buildingCompareIds = BuildingCatalogCompareSelection.Toggle(_buildingCompareIds, id);

			PublishBuildingCompare();
		}

		private void ClearBuildingCatalogCompare()
		{
			_buildingCompareIds = BuildingCatalogCompareSelection.Clear();

			PublishBuildingCompare();
		}

		private void SetBuildingCatalogSortColumn(string column)
		{
			if (string.IsNullOrWhiteSpace(column))
			{
				return;
			}

			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				SortColumn = column,
				Offset = 0,
				Limit = BuildingCatalogQuery.DefaultLimit,
			};

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Chooses the heading dimension, which is also the query's primary key.
		/// </summary>
		/// <remarks>
		/// The window shrinks back to the base chunk because the grouping
		/// reorders the whole result: the rows the player grew the window to
		/// reach are not the rows that would come back.
		/// </remarks>
		private void SetBuildingCatalogGroupBy(string groupBy)
		{
			if (string.IsNullOrWhiteSpace(groupBy))
			{
				return;
			}

			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				GroupBy = groupBy.Trim(),
				Offset = 0,
				Limit = BuildingCatalogQuery.DefaultLimit,
			};

			RefreshBuildingCatalog();
		}

		private void SetBuildingCatalogSortDescending(bool descending)
		{
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Descending = descending,
				Offset = 0,
				Limit = BuildingCatalogQuery.DefaultLimit,
			};

			RefreshBuildingCatalog();
		}

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
		private void LoadMoreBuildingCatalog()
		{
			if (_buildingCatalogQuery.Limit >= BuildingCatalogQuery.MaxLimit)
			{
				return;
			}

			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Limit = Math.Min(
					_buildingCatalogQuery.Limit + BuildingCatalogQuery.WindowStep,
					BuildingCatalogQuery.MaxLimit),
			};

			RefreshBuildingCatalog();
		}

		private void ToggleBuildingLensFacet(string facetId, string optionId)
		{
			BuildingCatalogQuery next = BuildingCatalogFacetSelection.Toggle(_buildingCatalogQuery, facetId, optionId);
			if (ReferenceEquals(next, _buildingCatalogQuery))
			{
				return;
			}

			_buildingCatalogQuery = next;
			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Same toggle the filter rail uses, exposed for the options bank's
		/// short-facet sections (see <see cref="Domain.Options.BuildingLensFacetOptionBase"/>).
		/// </summary>
		public void ToggleBuildingLensFacetOption(string facetId, string optionId) =>
			ToggleBuildingLensFacet(facetId, optionId);

		private void ClearBuildingLensFacets()
		{
			_buildingCatalogQuery = BuildingCatalogFacetSelection.Clear(_buildingCatalogQuery);
			RefreshBuildingCatalog();
		}

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
		private void ResetBuildingLensMenu()
		{
			ClearBuildingLensFilters();

			_buildingLensUiCategory = string.Empty;
			_BuildingLensMenuCategoryBinding.Value = _buildingLensUiCategory;
			ResetBuildingLensMilestone();
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();

			_CurrentSearch.Value = string.Empty;
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				SearchText = string.Empty,
				SortColumn = string.Empty,
				Descending = false,
				Offset = 0,
				Limit = BuildingCatalogQuery.DefaultLimit,
			};

			RefreshBuildingCatalog();
		}

		private void ClearBuildingLensFilters()
		{
			BuildingCatalogLensState cleared = new BuildingCatalogLensState(
				_buildingCatalogQuery,
				_buildingMetricRanges).ClearFilters();

			_buildingCatalogQuery = cleared.Query;
			_buildingMetricRanges = cleared.MetricRanges;
			// The zoning families are chips in the same row as the catalog's,
			// so a Clear that left them standing would visibly fail to do what
			// the button says.
			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Adds or removes one zoning family from the zone list's filter.
		/// </summary>
		/// <remarks>
		/// This replaces the exclusive family tab strip. The zone catalog is
		/// already published in full and grouped by family on the UI side, so
		/// narrowing is a matter of which groups to draw — no requery needed.
		/// </remarks>

		private void SetBuildingCatalogMetricRange(string metricId, string minText, string maxText)
		{
			if (!BuildingCatalogMetricRange.TryParse(metricId, minText, maxText, out BuildingCatalogMetricRange range))
			{
				return;
			}

			_buildingMetricRanges = _buildingMetricRanges.With(range);
			_buildingCatalogQuery = BuildingCatalogMetricRange.Apply(_buildingCatalogQuery, metricId, minText, maxText);
			RefreshBuildingCatalog();
		}

		private void ClearBuildingCatalogMetricRanges()
		{
			_buildingMetricRanges = BuildingCatalogMetricRangeState.Empty;
			_buildingCatalogQuery = BuildingCatalogMetricRange.Clear(_buildingCatalogQuery);
			RefreshBuildingCatalog();
		}

		internal void ToggleFindItPanel(bool visible, bool activatePrefab = true)
		{
			if (_ShowFindItPanel == visible || (_IsWindowLocked && _ShowFindItPanel))
			{
				return;
			}

			_ShowFindItPanel.Value = visible;

			if (!visible)
			{
				return;
			}

			_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();

			FindItUtil.SetSorting();

			RefreshLens();

			// RefreshLens already ran RefreshBuildingCatalog
			// above, which now refreshes the options bank itself once its facet
			// bindings are current. A second call here would just repeat that
			// with nothing having changed in between.

			if (activatePrefab && Mod.Settings.SelectPrefabOnOpen)
			{
				TryActivatePrefabTool(_ActivePrefabId);
			}
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

		/// <summary>
		/// Asks the game to open the vanilla menu that holds an asset.
		/// </summary>
		/// <remarks>
		/// For the picker. Since phase 2 the build menu exists only while the
		/// game has an asset menu open, so "show me this building" cannot mean
		/// "raise a panel" any more — it has to mean "open the menu it lives
		/// in", and then the ordinary path takes over: the game selects the
		/// menu, VanillaMenuWatcher sees it, and the lens opens scoped to it
		/// with the picked prefab already armed.
		///
		/// That is a better answer than the old one regardless. The picker used
		/// to drop the player into an unscoped grid of everything; now they land
		/// in the menu the building belongs to.
		///
		/// Returns false when the game places the asset in no menu at all, which
		/// is most of the 17,952 indexed assets — props, vegetation, vehicles.
		/// The caller falls back to arming the tool without a menu.
		/// </remarks>
		internal bool RequestVanillaMenu(int assetEntityIndex)
		{
			if (!Mod.Settings.ReplaceVanillaBuildMenu
				|| !PrefabIndexingSystem.TryGetMenuEntityFor(assetEntityIndex, out var menu))
			{
				return false;
			}

			// The nonce, not the entity, is what makes this a fresh request:
			// picking the same building twice publishes the same index and
			// version, and an unchanged binding value emits nothing.
			_pickerMenuNonce++;
			_PickerMenuRequest.Value = $"{menu.Index}:{menu.Version}:{_pickerMenuNonce}";
			return true;
		}

		private void ToggleLock()
		{
			_IsWindowLocked.Value = !_IsWindowLocked;
		}

		private void ExpandedToggled()
		{
			_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();

			RefreshLens();
		}




		private void SearchChanged(string text)
		{
			text = text.Replace("\r", "").Replace("\n", "");

			if (_CurrentSearch == text && FindItUtil.Filters.CurrentSearch == text)
			{
				return;
			}

			FindItUtil.Filters.CurrentSearch = text.Trim();

			_CurrentSearch.Value = text;
			_CurrentSearch.ForceUpdate();

			// Deliberately no inline RefreshBuildingCatalog() here. Every refresh
			// projects the whole building index twice — once for the page and
			// once to rebuild the facets — and doing that per keystroke made the
			// lens the only search path in the mod without a debounce. The
			// search worker below already re-runs the refresh once it settles,
			// via the filterCompleted branch in OnUpdate, which is the same
			// 250ms debounce the legacy grid has always used.
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
