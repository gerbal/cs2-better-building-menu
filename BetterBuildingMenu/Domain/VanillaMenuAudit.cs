using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One asset the game itself places in one of its own menus.
	/// </summary>
	/// <remarks>
	/// Deliberately plain data rather than <see cref="VanillaMenuPlacement"/>, which carries an
	/// ECS <c>Entity</c>. The comparison is about identities and names, and taking the handle
	/// would drag the whole entity world into a check that does not need it.
	/// </remarks>
	public readonly record struct VanillaMenuPlacementFact(
		int EntityIndex,
		string PrefabName,
		string Menu,
		string Category);

	/// <summary>
	/// One asset we hold and file under a menu name of our own.
	/// </summary>
	public readonly record struct IndexedMenuFact(
		int EntityIndex,
		string PrefabName,
		string Menu,
		bool IsServiceUpgrade);

	/// <summary>
	/// The comparison for one menu, both directions.
	/// </summary>
	public sealed record VanillaMenuAuditLine(
		string Menu,
		int Categories,
		int VanillaPlaces,
		int Held,
		int Ours,
		IReadOnlyList<string> Missing,
		IReadOnlyList<string> ExpectedExtras,
		IReadOnlyList<string> UnexplainedExtras);

	/// <summary>
	/// The whole census. <see cref="IsClean"/> is the verdict a test asserts on.
	/// </summary>
	public sealed record VanillaMenuAuditReport(
		IReadOnlyList<VanillaMenuAuditLine> Menus,
		IReadOnlyList<string> InventedMenus,
		int PlacementCount,
		int IndexedCount)
	{
		/// <summary>
		/// Three failures, and each is a different kind of wrong.
		/// </summary>
		/// <remarks>
		/// Missing is the one that matters to the player: the game offers something under a menu and
		/// we do not. InventedMenus means we filed assets under a menu the game has none for.
		/// UnexplainedExtras is an asset we offer that vanilla does not place and no rule explains.
		/// </remarks>
		public bool IsClean =>
			InventedMenus.Count == 0
			&& Menus.All(line => line.Missing.Count == 0 && line.UnexplainedExtras.Count == 0);
	}

	/// <summary>
	/// Compares the game's own menu placements against what the index holds,
	/// by the tree fields the index reads off the same UIObject.m_Group.
	/// </summary>
	/// <remarks>
	/// A coverage audit, not a taxonomy one: which assets vanilla offers under a menu that the
	/// indexer failed to hold, and which we file under a menu the game has no such menu for.
	/// </remarks>
	public static class VanillaMenuAudit
	{
		/// <summary>
		/// The divergences from vanilla's menus that are deliberate, and why.
		/// </summary>
		/// <remarks>
		/// Written down as a RULE rather than a list of names, which the next asset pack would
		/// outdate. The game marks service upgrades with <c>ServiceUpgradeData</c> and filters them
		/// out of every menu; the list matches that while keeping them indexed, so they surface here.
		/// </remarks>
		public static bool IsExpectedDivergence(IndexedMenuFact fact) => fact.IsServiceUpgrade;

		/// <summary>
		/// The reason, in one line, for the census to print beside the extras it
		/// is explaining.
		/// </summary>
		/// <remarks>
		/// Here rather than at the log site so the rule and its statement cannot
		/// drift apart: whoever changes <see cref="IsExpectedDivergence"/> is
		/// looking at the sentence that describes it.
		/// </remarks>
		public const string Divergences =
			"Service upgrades are indexed but never offered: vanilla places them from the parent building's row.";

		public static VanillaMenuAuditReport Compare(
			IEnumerable<VanillaMenuPlacementFact> vanillaPlacements,
			IEnumerable<IndexedMenuFact> ourMenuEntries,
			IEnumerable<int> heldEntityIndices)
		{
			if (vanillaPlacements is null) throw new ArgumentNullException(nameof(vanillaPlacements));
			if (ourMenuEntries is null) throw new ArgumentNullException(nameof(ourMenuEntries));
			if (heldEntityIndices is null) throw new ArgumentNullException(nameof(heldEntityIndices));

			var placements = vanillaPlacements.ToList();
			var ours = ourMenuEntries.Where(entry => !string.IsNullOrWhiteSpace(entry.Menu)).ToList();
			var held = new HashSet<int>(heldEntityIndices);

			bool IsHeld(VanillaMenuPlacementFact placement) => held.Contains(placement.EntityIndex);

			var placedEntities = new HashSet<int>(placements.Select(placement => placement.EntityIndex));
			var vanillaMenus = new HashSet<string>(placements.Select(placement => placement.Menu ?? "(none)"), StringComparer.Ordinal);

			var oursByMenu = ours
				.GroupBy(entry => entry.Menu, StringComparer.Ordinal)
				.ToDictionary(group => group.Key, group => group.ToList(), StringComparer.Ordinal);

			var lines = new List<VanillaMenuAuditLine>();

			foreach (var group in placements
				.GroupBy(placement => placement.Menu ?? "(none)", StringComparer.Ordinal)
				.OrderBy(group => group.Key, StringComparer.Ordinal))
			{
				var menuPlacements = group.ToList();
				oursByMenu.TryGetValue(group.Key, out var mine);
				mine ??= new List<IndexedMenuFact>();

				// Named, not counted. "missing=3" tells you a regression happened;
				// the three names tell you which walk stopped seeing them.
				var missing = menuPlacements
					.Where(placement => !IsHeld(placement))
					.Select(placement => placement.PrefabName ?? $"entity:{placement.EntityIndex}")
					.OrderBy(name => name, StringComparer.Ordinal)
					.ToList();

				var extras = mine.Where(entry => !placedEntities.Contains(entry.EntityIndex)).ToList();

				lines.Add(new VanillaMenuAuditLine(
					Menu: group.Key,
					Categories: new HashSet<string>(
						menuPlacements.Select(placement => placement.Category ?? string.Empty),
						StringComparer.Ordinal).Count,
					VanillaPlaces: menuPlacements.Count,
					Held: menuPlacements.Count - missing.Count,
					Ours: mine.Count,
					Missing: missing,
					ExpectedExtras: Names(extras.Where(IsExpectedDivergence)),
					UnexplainedExtras: Names(extras.Where(entry => !IsExpectedDivergence(entry)))));
			}

			// Menus we file assets under that the game has no such menu for at
			// all. A name we invented, or one the walk could not see — either way
			// nothing can ever open it.
			var invented = oursByMenu.Keys
				.Where(menu => !vanillaMenus.Contains(menu))
				.OrderBy(menu => menu, StringComparer.Ordinal)
				.ToList();

			return new VanillaMenuAuditReport(lines, invented, placements.Count, ours.Count);

			static IReadOnlyList<string> Names(IEnumerable<IndexedMenuFact> facts) =>
				facts
					.Select(fact => fact.PrefabName ?? $"entity:{fact.EntityIndex}")
					.OrderBy(name => name, StringComparer.Ordinal)
					.ToList();
		}
	}
}
