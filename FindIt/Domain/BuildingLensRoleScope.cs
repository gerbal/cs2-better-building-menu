using FindItBuildingMenu.Domain.Options;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Builds the Building Lens role tab strip: the identity axis one level
	/// below section/subCategory.
	/// </summary>
	/// <remarks>
	/// Section and subCategory come from a fixed taxonomy — VanillaBuildMenuTaxonomy
	/// knows every subcategory a section can hold before a single prefab is
	/// indexed. Role has no such taxonomy: which roles exist under, say, Police
	/// &amp; Administration is a fact about the data (Police Station and Prison
	/// today; a mod could add a third tomorrow), not a fact about the game's
	/// menu structure. So unlike the section/subCategory descriptor lists, this
	/// one is derived from the live catalog rather than a static table, which
	/// is also why it takes already-scoped entries instead of a section id —
	/// scoping them is <see cref="Services.BuildingCatalogQueryEngine.Filter"/>'s
	/// job, already exercised by the section/subCategory query filter tests.
	///
	/// A measured pass over the current catalog is why role, and not one of
	/// the other candidate axes, is what this strip is built on: Police &amp;
	/// Administration splits into Police Station (6) / Prison (2) / Other (3),
	/// Health &amp; Deathcare into Deathcare Facility (7) / Hospital (6) /
	/// Other (2), Water &amp; Sewage into Sewage Outlet (4) / Water Pumping
	/// Station (7), and Education &amp; Research into School (21) / Other (3) /
	/// Hospital (1) — genuine, in-the-game's-own-vocabulary subdivisions.
	/// Transportation has none at all (41 buildings, zero role groups), which
	/// is exactly why the strip has to make itself scarce rather than always
	/// showing: see the two-role floor below.
	/// </remarks>
	public static class BuildingLensRoleScope
	{
		private const string AllRoleIcon = "coui://finditbuildingmenu/Icons/Standard/StarAll.svg";

		/// <summary>
		/// Descriptors for the roles present in <paramref name="scopedEntries"/>,
		/// in <see cref="BuildingRole.Known"/> priority order, led by an "All"
		/// entry (<see cref="VanillaBuildMenuTaxonomy.Any"/>) that gets back to
		/// the unscoped view. Empty when fewer than two real roles are present.
		/// </summary>
		/// <remarks>
		/// The two-role floor exists because a lone role tab beside "All" would
		/// either duplicate what "All" already shows (one role = the whole
		/// scope) or, with zero roles, leave "All" standing on its own as noise
		/// with nothing to switch away from — see Transportation above. The
		/// caller drops the whole strip when this returns empty rather than
		/// rendering a single useless tab.
		/// </remarks>
		public static IReadOnlyList<VanillaBuildMenuDescriptor> GetDescriptors(
			IEnumerable<BuildingCatalogEntry> scopedEntries)
		{
			if (scopedEntries is null)
			{
				throw new ArgumentNullException(nameof(scopedEntries));
			}

			var present = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (BuildingCatalogEntry entry in scopedEntries)
			{
				if (!string.IsNullOrWhiteSpace(entry.BuildingType))
				{
					present.Add(entry.BuildingType!.Trim());
				}
			}

			if (present.Count < 2)
			{
				return Array.Empty<VanillaBuildMenuDescriptor>();
			}

			// BuildingRole.Known's order is the one already used to resolve a
			// primary role when a prefab carries several service components,
			// so reusing it here keeps the tab order predictable against that
			// same priority rather than inventing a second ordering. A role
			// the indexer produced but Known does not list — a modded service
			// component with no entry in the priority table — still needs a
			// tab, so it is appended alphabetically rather than dropped.
			IEnumerable<string> ordered = BuildingRole.Known
				.Where(present.Contains)
				.Concat(present
					.Where(role => !BuildingRole.Known.Contains(role, StringComparer.OrdinalIgnoreCase))
					.OrderBy(role => role, StringComparer.OrdinalIgnoreCase));

			var descriptors = new List<VanillaBuildMenuDescriptor>(present.Count + 1)
			{
				// Without this there is no way back to the unscoped menu once
				// a role tab is picked.
				new(VanillaBuildMenuTaxonomy.Any, AllRoleIcon, VanillaBuildMenuTaxonomy.Any),
			};

			descriptors.AddRange(ordered.Select(role => new VanillaBuildMenuDescriptor(
				role,
				RoleOption.IconFor(role),
				// Matches RoleOption's own key format (Tooltip.LABEL[FindItBuildingMenu.Role{role}]),
				// resolved the same way BuildingLensSubCategoryUIEntry resolves
				// every other tab label — reusing that lookup instead of a
				// second word-splitting formatter.
				$"Role{role}")));

			return descriptors;
		}
	}
}
