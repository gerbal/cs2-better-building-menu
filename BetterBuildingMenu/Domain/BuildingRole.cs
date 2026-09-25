using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Names what a building is for, from the service data the prefab carries.
	/// </summary>
	/// <remarks>
	/// Read off the service components the indexer already visits to derive
	/// capacity: they name the role directly and cover every service building.
	/// </remarks>
	public static class BuildingRole
	{
		/// <summary>
		/// Every role the indexer can produce, in the order a primary is resolved.
		/// Exposed so the filter UI offers exactly the set that is reachable.
		/// </summary>
		public static IReadOnlyList<string> Known => Priority;

		/// <summary>
		/// Priority when a prefab carries several service components: the entry holds
		/// one role, so the choice must not depend on the order they are read in.
		/// Primary purposes outrank storage-like secondary ones.
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
			// Garbage first: an incinerator is both, and is filed with the landfills it
			// sits beside, its store their unit, and its output a line of its own.
			"GarbageFacility",
			"PowerPlant",
			"DeathcareFacility",
			// Communications. Both name the building's whole purpose, so they sit with the
			// other primaries; they are last only because nothing in the catalog carries
			// them alongside another service, so their rank never decides anything.
			"PostFacility",
			"TelecomFacility",
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
