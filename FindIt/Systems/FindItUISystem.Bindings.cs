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
			_PanelWidth.Value = GridUtil.GetCurrentPanelWidth();
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

		private void SetBuildingCapacityFloor(int floor)
		{
			var boundedFloor = Math.Min(10000, Math.Max(0, floor));
			if (!IsEducationCapacityFilterVisible())
			{
				boundedFloor = 0;
			}

			_BuildingCapacityFloor.Value = boundedFloor;
			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				MinCapacity = boundedFloor > 0 ? boundedFloor : null,
				Offset = 0,
			};

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
			RefreshBuildingCatalog();

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
