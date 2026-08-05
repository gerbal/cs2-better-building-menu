using FindItBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// What the lens should show when a vanilla toolbar menu is opened.
	/// </summary>
	public sealed record VanillaMenuPreset(
		PrefabCategory Category,
		PrefabSubCategory SubCategory,
		bool IsZoning = false);

	/// <summary>
	/// Maps the vanilla toolbar's asset menus onto lens presets, so opening
	/// Electricity lands in the catalog already filtered to power buildings.
	/// </summary>
	/// <remarks>
	/// The keys are UIAssetMenuPrefab names read off the running toolbar's
	/// uiTag, which are not the icon filenames: the Healthcare button opens a
	/// menu named "Health & Deathcare", Water opens "Water & Sewage", and so on.
	/// Inferring them from icons produced a table where only four of eleven keys
	/// matched anything.
	///
	/// Ten of them line up almost 1:1 with <see cref="PrefabSubCategory"/>, which is
	/// why routing them needs no new query surface; Zones opens the zoning
	/// hierarchy instead, since zones are assignment tools rather than buildings.
	///
	/// Roads, Landscaping and Areas are deliberately absent. The networks,
	/// surfaces and areas they contain are not in the building catalog, so they
	/// fall through to the vanilla menu rather than opening an empty lens. Note this is about the
	/// menus, not the categories: ServiceBuildings_Roads and
	/// ServiceBuildings_Landscaping buildings — maintenance depots and the like
	/// — remain in the catalog and reachable by filtering.
	///
	/// An unrecognised menu also declines, so a modded toolbar entry falls
	/// through to vanilla instead of opening the lens on something unrelated.
	/// </remarks>
	public static class VanillaMenuPresets
	{
		private static readonly Dictionary<string, VanillaMenuPreset> Presets =
			new(StringComparer.OrdinalIgnoreCase)
			{
				["Electricity"] = Service(PrefabSubCategory.ServiceBuildings_Electricity),
				["Water & Sewage"] = Service(PrefabSubCategory.ServiceBuildings_Water),
				["Health & Deathcare"] = Service(PrefabSubCategory.ServiceBuildings_Health),
				["Garbage Management"] = Service(PrefabSubCategory.ServiceBuildings_Garbage),
				["Education & Research"] = Service(PrefabSubCategory.ServiceBuildings_EducationResearch),
				["Fire & Rescue"] = Service(PrefabSubCategory.ServiceBuildings_Fire),
				["Police & Administration"] = Service(PrefabSubCategory.ServiceBuildings_Police),
				["Transportation"] = Service(PrefabSubCategory.ServiceBuildings_Transportation),
				["Parks & Recreation"] = Service(PrefabSubCategory.ServiceBuildings_Parks),
				["Communications"] = Service(PrefabSubCategory.ServiceBuildings_Communications),
				["Signatures"] = new(PrefabCategory.Buildings, PrefabSubCategory.Any),
				["Zones"] = new(PrefabCategory.Buildings, PrefabSubCategory.Any, IsZoning: true),
			};

		private static VanillaMenuPreset Service(PrefabSubCategory subCategory) =>
			new(PrefabCategory.ServiceBuildings, subCategory);

		/// <summary>
		/// Every menu the lens will take over, keyed by prefab name.
		/// </summary>
		public static IReadOnlyDictionary<string, VanillaMenuPreset> Known => Presets;

		/// <summary>
		/// The preset for a toolbar menu, or null when the lens should leave it
		/// to the vanilla grid.
		/// </summary>
		public static VanillaMenuPreset? Resolve(string? menuName)
		{
			if (string.IsNullOrWhiteSpace(menuName))
			{
				return null;
			}

			return Presets.TryGetValue(menuName.Trim(), out var preset) ? preset : null;
		}
	}
}
