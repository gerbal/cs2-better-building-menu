using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Utilities;
using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

using Unity.Entities;

namespace FindItBuildingMenu.Systems
{
    internal partial class FindItUISystem : ExtendedUISystemBase
	{
		private void FindItIconClicked()
		{
			if (_ShowFindItPanel)
			{
				ToggleFindItPanel(false);

				// Clear the selected prefab
				_toolSystem.ActivatePrefabTool(null);
			}
			else
			{
				ToggleFindItPanel(true);
			}
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

			if (preset is null)
			{
				// Roads, Landscaping, Areas, or a modded menu. The player asked
				// for that menu, so get out of its way: the lens panel sits over
				// exactly where the vanilla asset grid appears, and leaving it up
				// would hide the menu they just clicked.
				_LensOwnsCurrentMenu.Value = false;

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

				if (_ShowFindItPanel)
				{
					ToggleFindItPanel(false);
				}

				return;
			}

			_LensOwnsCurrentMenu.Value = true;

			if (preset.IsZoning)
			{
				// Zones are assignment tools rather than buildings, so the
				// zoning hierarchy handles them instead of the building table.
				_ZoneCatalog.Value = PrefabIndexingSystem.GetZoneCatalog().ToArray();
				_ShowZoningHierarchy.Value = true;
				// The container renders the hierarchy only inside the lens, so
				// without this the panel opens on the plain asset grid.
				_BuildingLensEnabled.Value = true;
				_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();
				ToggleFindItPanel(true);
				return;
			}

			_ShowZoningHierarchy.Value = false;
			_BuildingLensEnabled.Value = true;

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
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0 };

			scrollIndex = 0;

			ToggleFindItPanel(true);
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
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
			_BuildingLensSectionBinding.Value = _buildingLensSection;
			_BuildingLensSubCategoryBinding.Value = _buildingLensSubCategory;
			FindItUtil.CurrentCategory = PrefabCategory.Any;
			FindItUtil.CurrentSubCategory = PrefabSubCategory.Any;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0 };

			scrollIndex = 0;

			RefreshBuildingLensNavigation();
			UpdateCategoriesAndPrefabList();
			RefreshBuildingCatalog();
		}

		private void SetCurrentSubCategory(int category)
		{
			FindItUtil.CurrentSubCategory = (PrefabSubCategory)category;

			scrollIndex = 0;

			UpdateCategoriesAndPrefabList();

			if (FindItUtil.Filters.GetFilterList().Any()) // Check if there are any active filters
			{
				// Trigger the delayed search instead of refreshing the list immediately

				TriggerSearch();
			}

			_optionsUISystem.RefreshOptions();
		}

		private void SetBuildingLensEnabled(bool enabled)
		{
			_BuildingLensEnabled.Value = enabled;
			RefreshBuildingLensNavigation();
			_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();
			RefreshBuildingCatalog();
		}

		private void SetBuildingLensSection(string section)
		{
			// The zoning hierarchy is armed by the vanilla Zones menu and was
			// never disarmed by anything else, so choosing a building section
			// left the zone tiles on screen under a breadcrumb that read
			// "Buildings" and a count of 3,667. Only the interception path could
			// see this before; the section picker made it reachable.
			_ShowZoningHierarchy.Value = false;

			VanillaBuildMenuSelection selection = VanillaBuildMenuSelection.Normalize(section, VanillaBuildMenuTaxonomy.Any);
			_buildingLensSection = selection.Section;
			_buildingLensSubCategory = selection.SubCategory;
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Offset = 0,
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
				MinCapacity = null,
			};
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}

		private void SetBuildingLensPanelWidth(float width)
		{
			if (!_BuildingLensEnabled)
			{
				return;
			}

			_PanelWidth.Value = GridUtil.ClampBuildingLensWidth(width);
		}

		private void CommitBuildingLensPanelWidth()
		{
			if (!_BuildingLensEnabled)
			{
				return;
			}

			var width = GridUtil.ClampBuildingLensWidth(_PanelWidth);
			if (Math.Abs(Mod.Settings.BuildingLensPanelWidth - width) < 0.1f)
			{
				return;
			}

			Mod.Settings.BuildingLensPanelWidth = width;
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
			};

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Chooses the heading dimension, which is also the query's primary key.
		/// </summary>
		/// <remarks>
		/// Offset resets because the grouping reorders the whole result: keeping
		/// the old offset would land the player somewhere unrelated to where
		/// they were looking.
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
			};

			RefreshBuildingCatalog();
		}

		private void SetBuildingCatalogSortDescending(bool descending)
		{
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Descending = descending,
				Offset = 0,
			};

			RefreshBuildingCatalog();
		}

		private void SetBuildingCatalogOffset(int offset)
		{
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				Offset = offset,
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

		private void ClearBuildingLensFacets()
		{
			_buildingCatalogQuery = BuildingCatalogFacetSelection.Clear(_buildingCatalogQuery);
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
			_zoneFamilies = System.Array.Empty<string>();
			_BuildingLensZoneFamilies.Value = _zoneFamilies;
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
		private void ToggleBuildingLensZoneFamily(string family)
		{
			_zoneFamilies = ZoneFamilySelection.Toggle(_zoneFamilies, family);
			_BuildingLensZoneFamilies.Value = _zoneFamilies;
		}

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
			_PanelHeight.Value = GridUtil.GetHeight();

			FindItUtil.SetSorting();

			UpdateCategoriesAndPrefabList();

			_optionsUISystem.RefreshOptions();

			if (activatePrefab && Mod.Settings.SelectPrefabOnOpen)
			{
				TryActivatePrefabTool(_ActivePrefabId);

				var prefabs = FindItUtil.GetFilteredPrefabs();
				var columns = GridUtil.GetCurrentColumnCount();
				var rows = GridUtil.GetCurrentRowCount();
				var index = prefabs.IndexOf(FindItUtil.GetPrefabIndex(_ActivePrefabId));

				SetScrollIndex(Math.Max(0, Math.Floor(index / columns) - (rows / 4)));
			}
		}

		private void ToggleLock()
		{
			_IsWindowLocked.Value = !_IsWindowLocked;
		}

		private void ExpandedToggled()
		{
			_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();
			_PanelHeight.Value = GridUtil.GetHeight();

			UpdateCategoriesAndPrefabList();
		}

		private void OnSearchKeyPressed()
		{
			if (_ShowFindItPanel || _IsWindowLocked)
			{
				_FocusSearchBar.Value = true;
			}
			else
			{
				ToggleFindItPanel(true);
			}
		}

		private void SetScrollIndex(double index)
		{
			if (scrollIndex == index)
			{
				return;
			}

			scrollIndex = index;

			if (Mod.Settings.SmoothScroll)
			{
				_PrefabListBinding.Value = GetDisplayedPrefabs();
			}
			else
			{
				Task.Run(DelayedApplyScroll);
			}
		}

		private void OnScroll(int direction)
		{
			SetScrollIndex(scrollIndex +
				(Mod.Settings.ScrollSpeed
				* (direction > 0 ? 1f : -1f)
				* GridUtil.GetScrollMultiplier()
				/ GridUtil.GetCurrentRowCount()));
		}

		private async Task DelayedApplyScroll()
		{
			var token = scrollTokenSource.Token;

			await Task.Delay(50);

			if (!token.IsCancellationRequested)
			{
				scrollTokenSource.Cancel();
				scrollTokenSource = new();

				scrollCompleted = true;
			}
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

		private void MoveSelectedItemGrid(int x, int y)
		{
			var prefabs = FindItUtil.GetFilteredPrefabs();
			var columns = GridUtil.GetCurrentColumnCount();
			var rows = GridUtil.GetCurrentRowCount();
			var currentIndex = prefabs.IndexOf(FindItUtil.GetPrefabIndex(_ActivePrefabId));

			if (prefabs.Count == 0)
			{
				return;
			}

			currentIndex += x + (y * (int)Math.Floor(columns));
			currentIndex = Math.Min(Math.Max(0, currentIndex), prefabs.Count - 1);

			TryActivatePrefabTool(prefabs[currentIndex].Id);
			SetScrollIndex(Math.Max(0, Math.Floor(currentIndex / columns) - (rows / 4)));
		}

		private void OnRandomButtonClicked()
		{
			var random = new Random(Guid.NewGuid().GetHashCode());
			var prefabs = FindItUtil.GetFilteredPrefabs();
			var columns = GridUtil.GetCurrentColumnCount();
			var rows = GridUtil.GetCurrentRowCount();

			if (prefabs.Count == 0)
			{
				return;
			}

			var index = random.Next(prefabs.Count);

			TryActivatePrefabTool(prefabs[index].Id);
			SetScrollIndex(Math.Max(0, Math.Floor(index / columns) - (rows / 4)));
		}

		private void OnLocateButtonClicked(int id)
		{
			var entities = PrefabTrackingSystem.GetPlacedEntities(id);
			_interactionBoundary.TryLocate(id, entities.Count, index => JumpTo(entities[index]));
		}

		private void OnPdxModsButtonClicked(int id)
		{
			try
			//{ Process.Start($"skyve://mods/{FindItUtil.GetPrefabIndex(id).PdxModsId}"); }
			{
				Process.Start($"https://mods.paradoxplaza.com/mods/{FindItUtil.GetPrefabIndex(id).PdxModsId}/Windows");
			}
			catch { }
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
