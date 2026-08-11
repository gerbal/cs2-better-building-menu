using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;
using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
    public class Filters
	{
		public string CurrentSearch { get; set; }
		public ZoneTypeFilter SelectedZoneType { get; set; } = ZoneTypeFilter.Any;
		public int LotWidthFilter { get; set; }
		public int LotDepthFilter { get; set; }
		public BuildingCornerFilter SelectedBuildingCorner { get; set; }
		public bool HideAds { get; set; }
		public bool HideRandoms { get; set; }
		public bool HideVanilla { get; set; }
		public int BuildingLevelFilter { get; set; }
		public bool OnlyPlaced { get; set; }
		public bool UniqueMesh { get; set; }
		public bool WithParking { get; set; }
		public bool WithoutParking { get; set; }
		public ValueSign LotWidthSign { get; set; } = ValueSign.Equal;
		public ValueSign LotDepthSign { get; set; } = ValueSign.Equal;
		public ValueSign BuildingLevelSign { get; set; } = ValueSign.Equal;

		// Dimensions Building Lens could already filter on while the asset grid
		// could not, even though PrefabIndex has carried all three all along.
		public BuildingFlags? SelectedPlacementFlags { get; set; }
		public List<string> SelectedExtensions { get; set; }
		public List<string> SelectedRoles { get; set; }

		public static Func<string, Func<PrefabIndex, bool>> GetCustomSearchFunction { get; set; }

		public IEnumerable<Func<PrefabIndex, bool>> GetFilterList(bool includeSearch = true)
		{
			if (HideAds)
			{
				yield return DoAdFilter;
			}

			if (HideRandoms)
			{
				yield return DoRandomFilter;
			}

			if (HideVanilla)
			{
				yield return DoNoVanillaFilter;
			}

			if (UniqueMesh)
			{
				yield return DoUniqueMeshFilter;
			}

			if (OnlyPlaced)
			{
				yield return DoOnlyPlacedFilter;
			}

			if (WithParking)
			{
				yield return DoWithParking;
			}
			else if (WithoutParking)
			{
				yield return DoWithoutParking;
			}

			if (SelectedZoneType != ZoneTypeFilter.Any)
			{
				yield return DoZoneTypeFilter;
			}

			if (SelectedBuildingCorner != BuildingCornerFilter.Any)
			{
				yield return DoBuildingCornerFilter;
			}

			if (BuildingLevelFilter != 0)
			{
				yield return DoBuildingLevelFilter;
			}

			if (LotDepthFilter != 0)
			{
				yield return DoLotDepthFilter;
			}

			if (LotWidthFilter != 0)
			{
				yield return DoLotWidthFilter;
			}

			if (SelectedPlacementFlags.HasValue && SelectedPlacementFlags.Value != default)
			{
				yield return DoPlacementFlagFilter;
			}

			if (SelectedExtensions is { Count: > 0 })
			{
				yield return DoExtensionFilter;
			}

			if (SelectedRoles is { Count: > 0 })
			{
				yield return DoRoleFilter;
			}

			if (includeSearch && !string.IsNullOrWhiteSpace(CurrentSearch))
			{
				if (GetCustomSearchFunction is null)
					yield return Mod.Settings.StrictSearch ? DoStrictSearchFilter : DoSearchFilter;
				else
					yield return GetCustomSearchFunction(CurrentSearch);
			}
		}

		private bool DoPlacementFlagFilter(PrefabIndex prefab)
		{
			return FindItFilterPredicates.MatchesAnyPlacementFlag(prefab.BuildingFlagsValue, SelectedPlacementFlags);
		}

		private bool DoExtensionFilter(PrefabIndex prefab)
		{
			return FindItFilterPredicates.MatchesAnyExtension(prefab.ExtensionIds, SelectedExtensions);
		}

		private bool DoRoleFilter(PrefabIndex prefab)
		{
			return FindItFilterPredicates.MatchesAnyRole(prefab.BuildingTypeName, SelectedRoles);
		}

		private bool DoSearchFilter(PrefabIndex prefab)
		{
			return CurrentSearch.SearchCheck(prefab.Name)
				|| CurrentSearch.SearchCheck(prefab.PrefabName)
				|| (prefab.PdxModsId == CurrentSearch);
			//|| prefab.Tags.Any(DoTagSearch);
		}

		private bool DoStrictSearchFilter(PrefabIndex prefab)
		{
			return prefab.Name.IndexOf(CurrentSearch, StringComparison.InvariantCultureIgnoreCase) >= 0
				|| prefab.PrefabName.IndexOf(CurrentSearch, StringComparison.InvariantCultureIgnoreCase) >= 0
				|| (prefab.PdxModsId == CurrentSearch);
			//|| prefab.Tags.Any(DoTagSearch);
		}

		private bool DoTagSearch(string tag)
		{
			return tag.IndexOf(CurrentSearch, StringComparison.InvariantCultureIgnoreCase) >= 0;
		}

		private bool DoBuildingCornerFilter(PrefabIndex prefab)
		{
			return (prefab.CornerType & SelectedBuildingCorner) == SelectedBuildingCorner;
		}

		private bool DoZoneTypeFilter(PrefabIndex prefab)
		{
			return prefab.ZoneType == SelectedZoneType;
		}

		private bool DoWithParking(PrefabIndex prefab)
		{
			return prefab.HasParking;
		}

		private bool DoWithoutParking(PrefabIndex prefab)
		{
			return !prefab.HasParking;
		}

		private bool DoBuildingLevelFilter(PrefabIndex prefab)
		{
			return BuildingLevelSign switch
			{
				ValueSign.LessThan => prefab.BuildingLevel < BuildingLevelFilter,
				ValueSign.GreaterThan => prefab.BuildingLevel > BuildingLevelFilter,
				ValueSign.NotEqual => prefab.BuildingLevel != BuildingLevelFilter,
				ValueSign.Equal => prefab.BuildingLevel == BuildingLevelFilter,
				_ => true,
			};
		}

		private bool DoLotWidthFilter(PrefabIndex prefab)
		{
			return LotWidthSign switch
			{
				ValueSign.LessThan => prefab.LotSize.x < LotWidthFilter,
				ValueSign.GreaterThan => prefab.LotSize.x > LotWidthFilter,
				ValueSign.NotEqual => (LotWidthFilter != 10 || prefab.LotSize.x < 10) && prefab.LotSize.x != LotWidthFilter,
				ValueSign.Equal => (LotWidthFilter == 10 && prefab.LotSize.x >= 10) || prefab.LotSize.x == LotWidthFilter,
				_ => true,
			};
		}

		private bool DoLotDepthFilter(PrefabIndex prefab)
		{
			return LotDepthSign switch
			{
				ValueSign.LessThan => prefab.LotSize.y < LotDepthFilter,
				ValueSign.GreaterThan => prefab.LotSize.y > LotDepthFilter,
				ValueSign.NotEqual => (LotDepthFilter != 10 || prefab.LotSize.y < 10) && prefab.LotSize.y != LotDepthFilter,
				ValueSign.Equal => (LotDepthFilter == 10 && prefab.LotSize.y >= 10) || prefab.LotSize.y == LotDepthFilter,
				_ => true,
			};
		}

		private bool DoAdFilter(PrefabIndex prefab)
		{
			return prefab.SubCategory != PrefabSubCategory.Props_Branding;
		}

		private bool DoRandomFilter(PrefabIndex prefab)
		{
			return !prefab.IsRandom;
		}

		private bool DoNoVanillaFilter(PrefabIndex prefab)
		{
			return !prefab.IsVanilla;
		}

		private bool DoUniqueMeshFilter(PrefabIndex prefab)
		{
			return prefab.IsUniqueMesh;
		}

		private bool DoOnlyPlacedFilter(PrefabIndex prefab)
		{
			return PrefabTrackingSystem.GetMostUsedCount(prefab) > 0;
		}

	}
}
