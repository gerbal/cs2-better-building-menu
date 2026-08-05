using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Names what a building is for, from the service data the prefab carries.
	/// </summary>
	/// <remarks>
	/// The Role facet used to read <c>BuildingMarkerData.m_BuildingType</c>, an
	/// editor marker component that ordinary building prefabs do not have, so the
	/// dimension was wired end to end — query field, toggle, adapter group, UI —
	/// and silently produced nothing, because the adapter drops a facet group
	/// with no values.
	///
	/// The service components the indexer already reads to derive capacity name
	/// the role directly and cover every service building in the catalog.
	/// </remarks>
	public static class BuildingRole
	{
		/// <summary>
		/// Priority order used when a prefab carries several service components.
		/// The entry holds one role, so the choice must not depend on the order
		/// the components happen to be read in. Roles that describe the
		/// building's primary purpose outrank storage-like secondary ones.
		/// </summary>
		private static readonly string[] Priority =
		{
			"School",
			"Hospital",
			"FireStation",
			"PoliceStation",
			"Prison",
			"EmergencyShelter",
			"WaterPumpingStation",
			"WastewaterTreatmentPlant",
			"SewageOutlet",
			"GarbageFacility",
			"DeathcareFacility",
		};

		/// <summary>
		/// The single role to file a prefab under, or null when it has none.
		/// </summary>
		public static string? ResolvePrimary(IEnumerable<string>? roles)
		{
			if (roles is null)
			{
				return null;
			}

			var present = roles
				.Where(role => !string.IsNullOrWhiteSpace(role))
				.Select(role => role.Trim())
				.ToList();

			if (present.Count == 0)
			{
				return null;
			}

			foreach (var candidate in Priority)
			{
				if (present.Contains(candidate))
				{
					return candidate;
				}
			}

			// A service component this build has no entry for still names its
			// buildings; dropping it would leave them unfilterable.
			return present[0];
		}
	}
}
