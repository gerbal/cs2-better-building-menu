using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One asset the game itself places in one of its own menus.
	/// </summary>
	/// <remarks>
	/// Deliberately plain data rather than <see cref="VanillaMenuPlacement"/>,
	/// which carries an ECS <c>Entity</c>. The comparison below is about
	/// identities and names; taking the handle would drag the whole entity world
	/// into a check that does not need it, and is the reason this only ever
	/// existed as a log line.
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
		/// <see cref="VanillaMenuAuditLine.Missing"/> is the one that matters to
		/// the player: the game offers something under a menu and we do not.
		/// <see cref="InventedMenus"/> means we filed assets under a menu name
		/// the game has no menu for, so nothing can ever open it.
		/// <see cref="VanillaMenuAuditLine.UnexplainedExtras"/> is an asset we
		/// offer that vanilla does not place and that no recorded divergence
		/// explains — either a new divergence to write down, or a bug.
		/// </remarks>
		public bool IsClean =>
			InventedMenus.Count == 0
			&& Menus.All(line => line.Missing.Count == 0 && line.UnexplainedExtras.Count == 0);
	}

	/// <summary>
	/// Compares what the game places in its menus against what we would show,
	/// in both directions.
	/// </summary>
	/// <remarks>
	/// This is the contract behind cm-e98i's first half — "opening the lens from
	/// a vanilla toolbar section yields the same set that section shows". It ran
	/// for a week as <c>[MENU-AUDIT]</c> log lines, which is a census rather than
	/// a check: it could only be read by booting a save and grepping
	/// <c>Modding.log</c>, so nothing stopped the mapping regressing between
	/// boots. The arithmetic moved here unchanged; the system now gathers the
	/// facts, calls this, and logs the result.
	///
	/// Live figures at the time of extraction (2026-08-15, developed save,
	/// vanilla + no asset packs): 15 menus, 840 placements, 17952 indexed
	/// assets, 31 zones, <c>missing=0</c> on every menu, and six extras — all
	/// six service upgrades, all explained by <see cref="Divergences"/>.
	/// </remarks>
	/// <summary>
	/// Compares the game's own menu placements against what the index holds,
	/// by the tree fields the index reads off the same UIObject.m_Group.
	/// </summary>
	/// <remarks>
	/// A coverage audit, not a taxonomy one: it says which assets vanilla
	/// offers under a menu that the indexer failed to hold, and which we
	/// file under a menu the game has no such menu for. It is the check
	/// that caught the roads-cost bug. It outlived the section taxonomy it
	/// was once mistaken for auditing.
	/// </remarks>
	public static class VanillaMenuAudit
	{
		/// <summary>
		/// The divergences from vanilla's menus that are deliberate, and why.
		/// </summary>
		/// <remarks>
		/// Written down as a RULE rather than a list of names. The six instances
		/// today are five in Transportation (SubwayYard01/02 Maintenance Hall,
		/// CargoTrainTerminal01/02 Storage Warehouse, CargoHarbor01 Warehouses)
		/// and one in Health &amp; Deathcare (Crematorium01 Hearse Garage), but
		/// pinning those names would fail on the next asset pack that adds an
		/// upgrade, and would pass while silently offering it.
		///
		/// SERVICE UPGRADES. The game marks them with <c>ServiceUpgradeData</c>
		/// and runs <c>FilterOutUpgrades</c> over every menu before drawing it,
		/// because an upgrade is placed from its parent building's row and has no
		/// standalone placement to offer. We match that in the list — see
		/// <c>GetIndexedBuildings</c> — but we keep them INDEXED, so the parent
		/// row can still name them through Extensions and the facets can still
		/// count them. Indexed-but-not-placed is exactly what makes them show up
		/// here as ours-without-a-vanilla-placement, and it is intended.
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
