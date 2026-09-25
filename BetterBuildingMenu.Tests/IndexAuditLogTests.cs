using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Linq;

using Unity.Entities;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The menu audit, the menu coverage report and the processor census, as a full pass words
	/// them for the log.
	/// </summary>
	public sealed class IndexAuditLogTests
	{
		/// <summary>An index over menus placing each asset by (id, menu, category), with these zones.</summary>
		private static CatalogIndex IndexOver(
			(int Id, string Menu, string Category)[] placements,
			int[] zoneIds,
			params PrefabIndex[] entries)
		{
			var menus = new VanillaMenuIndex(
				placements.ToDictionary(
					placement => placement.Id,
					placement => new VanillaMenuPlacement(new Entity { Index = placement.Id, Version = 1 }, placement.Menu, placement.Category, CategoryPriority: 0)),
				new Dictionary<int, string>(),
				new Dictionary<string, Entity>(),
				Array.Empty<VanillaMenuCategory>(),
				new Dictionary<string, List<VanillaMenuCategory>>());
			var zones = new ZoneIndex(
				new Dictionary<int, ZoneTypeFilter>(),
				new Dictionary<int, ZoneTypeFilter>(),
				new Dictionary<int, ZoneLotSizes>(),
				zoneIds.Select(id => new ZoneCatalogEntry(id, 1, $"Zone{id}", $"Zone {id}", "Residential", ZoneTypeFilter.Mixed, string.Empty)).ToList());

			return TestPrefabs.ReadyIndex(new CatalogIndex(menus, zones), entries);
		}

		/// <summary>An entry the index files under a vanilla menu and tab.</summary>
		private static PrefabIndex Held(int id, string menu, string? category)
		{
			var entry = TestPrefabs.Named(id, $"Road{id}", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			entry.UiMenuName = menu;
			entry.UiCategoryName = category;
			return entry;
		}

		private static string Describe(VanillaMenuPlacement placement) => $"P{placement.Entity.Index}";

		[Fact]
		public void APlacedZoneCountsInVanillaButIsNeverMissing()
		{
			var index = IndexOver(new[] { (5, "Zones", "Residential"), (6, "Zones", "Residential") }, new[] { 5 });

			var report = VanillaMenuCoverage.Compare(index, Describe);

			var line = Assert.Single(report.Lines);
			Assert.Equal(2, line.Vanilla);
			Assert.Equal(new[] { "P6" }, line.Missing);
			Assert.Equal(1, report.MissingCount);
		}

		[Fact]
		public void AnEntryFiledUnderAnotherTabIsMisplacedNotMissing()
		{
			var index = IndexOver(
				new[] { (7, "Roads", "RoadsSmall"), (8, "Roads", "RoadsSmall") },
				Array.Empty<int>(),
				Held(7, "Roads", "RoadsLarge"),
				Held(8, "Roads", null));

			var report = VanillaMenuCoverage.Compare(index, Describe);

			var line = Assert.Single(report.Lines);
			Assert.Empty(line.Missing);
			Assert.Equal(new[] { "Road7->RoadsLarge", "Road8->none" }, line.Misplaced);
			Assert.Equal(0, report.MissingCount);
			Assert.Equal(
				new[]
				{
					new AuditLine(
						AuditSeverity.Warn,
						"[MENU-COVERAGE] menu=\"Roads\" category=\"RoadsSmall\" vanilla=2 missing=0 [] misplaced=[Road7->RoadsLarge,Road8->none]"),
					new AuditLine(AuditSeverity.Info, "[MENU-COVERAGE] vanilla shows 2 assets across its menus; 0 missing from the index"),
				},
				IndexAuditLog.MenuCoverage(report));
		}

		[Fact]
		public void ACoveredTabLogsNoLineAndTheSummaryIsInfo()
		{
			var index = IndexOver(new[] { (7, "Roads", "RoadsSmall") }, Array.Empty<int>(), Held(7, "Roads", "RoadsSmall"));

			var lines = IndexAuditLog.MenuCoverage(VanillaMenuCoverage.Compare(index, Describe)).ToList();

			var summary = Assert.Single(lines);
			Assert.Equal(AuditSeverity.Info, summary.Severity);
			Assert.Equal("[MENU-COVERAGE] vanilla shows 1 assets across its menus; 0 missing from the index", summary.Text);
		}

		[Fact]
		public void AGapIsAWarningAndSoIsTheSummary()
		{
			var index = IndexOver(new[] { (6, "Roads", "RoadsSmall") }, Array.Empty<int>());

			var lines = IndexAuditLog.MenuCoverage(VanillaMenuCoverage.Compare(index, Describe)).ToList();

			Assert.Equal(
				new[]
				{
					new AuditLine(AuditSeverity.Warn, "[MENU-COVERAGE] menu=\"Roads\" category=\"RoadsSmall\" vanilla=1 missing=1 [P6]"),
					new AuditLine(AuditSeverity.Warn, "[MENU-COVERAGE] vanilla shows 1 assets across its menus; 1 missing from the index"),
				},
				lines);
		}

		[Fact]
		public void TabsAreReportedInOrdinalMenuThenCategoryOrder()
		{
			var index = IndexOver(
				new[] { (1, "b", "x"), (2, "a", "y"), (3, "B", "x"), (4, "a", "x") },
				Array.Empty<int>());

			var report = VanillaMenuCoverage.Compare(index, Describe);

			Assert.Equal(
				new[] { ("B", "x"), ("a", "x"), ("a", "y"), ("b", "x") },
				report.Lines.Select(line => (line.Menu, line.Category)));
		}

		[Fact]
		public void OnlyAnAssetTheIndexLacksIsDescribed()
		{
			var described = new List<int>();
			var index = IndexOver(
				new[] { (5, "Zones", "Residential"), (6, "Roads", "RoadsSmall"), (7, "Roads", "RoadsSmall") },
				new[] { 5 },
				Held(7, "Roads", "RoadsSmall"));

			VanillaMenuCoverage.Compare(index, placement =>
			{
				described.Add(placement.Entity.Index);
				return Describe(placement);
			});

			Assert.Equal(new[] { 6 }, described);
		}

		/// <summary>A placement the game cannot resolve is named by its entity, as the coverage
		/// report names it, not left blank.</summary>
		[Fact]
		public void AnAssetTheGameCannotNameIsNamedByItsEntity()
		{
			var index = IndexOver(new[] { (6, "Roads", "RoadsSmall") }, Array.Empty<int>());

			var body = Assert.Single(IndexAuditLog.MenuAuditBody(VanillaMenuAudit.Gather(index, _ => null)));

			Assert.Equal("[MENU-AUDIT] menu=\"Roads\" categories=1 vanilla=1 held=0 missing=1 ours=0 [entity:6]", body.Text);
		}

		[Fact]
		public void TheAuditCountsAZoneAsHeld()
		{
			var index = IndexOver(new[] { (5, "Zones", "Residential") }, new[] { 5 });

			var report = VanillaMenuAudit.Gather(index, Describe);

			var line = Assert.Single(report.Menus);
			Assert.Equal(1, line.Held);
			Assert.Empty(line.Missing);
			Assert.True(report.IsClean);
			// Clean, and with no extras to explain: one line, no verdict, no divergence note.
			Assert.Equal(
				new[] { new AuditLine(AuditSeverity.Info, "[MENU-AUDIT] 1 vanilla menus, 1 placements, 0 indexed assets, 1 zones") },
				IndexAuditLog.MenuAuditHeader(report, index.All.Count, index.Zones.Catalog.Count));
		}

		[Fact]
		public void TheAuditCapsBothListsAndNamesTheUnexplained()
		{
			var ours = Enumerable.Range(10, 9).Select(id => Held(id, "Roads", "RoadsSmall")).ToArray();
			var index = IndexOver(
				Enumerable.Range(1, 9).Select(id => (id, "Roads", "RoadsSmall")).ToArray(),
				Array.Empty<int>(),
				ours);

			var report = VanillaMenuAudit.Gather(index, Describe);

			Assert.Equal(
				new[] { new AuditLine(AuditSeverity.Info, "[MENU-AUDIT] 1 vanilla menus, 9 placements, 9 indexed assets, 0 zones — NOT CLEAN") },
				IndexAuditLog.MenuAuditHeader(report, index.All.Count, index.Zones.Catalog.Count));
			Assert.Equal(
				new[]
				{
					new AuditLine(
						AuditSeverity.Info,
						"[MENU-AUDIT] menu=\"Roads\" categories=1 vanilla=9 held=0 missing=9 ours=9 [P1,P2,P3,P4,P5,P6,P7,P8,…] "
						+ "UNEXPLAINED=9 [Road10,Road11,Road12,Road13,Road14,Road15,Road16,Road17,…]"),
				},
				IndexAuditLog.MenuAuditBody(report));
		}

		[Fact]
		public void TheAuditWordsAMenuAsItAlwaysHas()
		{
			var wing = Held(9, "Roads", null);
			wing.PrefabName = "Wing9";
			wing.IsServiceUpgrade = true;
			var index = IndexOver(
				new[] { (1, "Roads", "RoadsSmall"), (2, "Roads", "RoadsSmall"), (3, "Roads", "RoadsLarge") },
				Array.Empty<int>(),
				Held(1, "Roads", "RoadsSmall"),
				wing);

			var report = VanillaMenuAudit.Gather(index, Describe);

			Assert.Equal(
				new[]
				{
					new AuditLine(AuditSeverity.Info, "[MENU-AUDIT] 1 vanilla menus, 3 placements, 2 indexed assets, 0 zones — NOT CLEAN"),
					new AuditLine(AuditSeverity.Info, $"[MENU-AUDIT] expectedExtras: {VanillaMenuAudit.Divergences}"),
				},
				IndexAuditLog.MenuAuditHeader(report, index.All.Count, index.Zones.Catalog.Count));
			Assert.Equal(
				new[]
				{
					new AuditLine(
						AuditSeverity.Info,
						"[MENU-AUDIT] menu=\"Roads\" categories=2 vanilla=3 held=1 missing=2 ours=2 [P2,P3] expectedExtras=1 [Wing9]"),
				},
				IndexAuditLog.MenuAuditBody(report));
		}

		[Fact]
		public void AMenuTheGameHasNoneOfIsAWarning()
		{
			var index = IndexOver(Array.Empty<(int, string, string)>(), Array.Empty<int>(), Held(7, "Invented", "Tab"));

			var line = Assert.Single(IndexAuditLog.MenuAuditBody(VanillaMenuAudit.Gather(index, Describe)));

			Assert.Equal(
				new AuditLine(AuditSeverity.Warn, "[MENU-AUDIT] menu=\"Invented\" is not a vanilla menu at all, yet our assets claim it"),
				line);
		}

		[Fact]
		public void CapKeepsEightNamesAndMarksTheRest()
		{
			var eight = Enumerable.Range(1, 8).Select(i => $"n{i}").ToList();
			var nine = Enumerable.Range(1, 9).Select(i => $"n{i}").ToList();

			Assert.Equal("n1,n2,n3,n4,n5,n6,n7,n8", IndexAuditLog.Cap(eight));
			Assert.Equal("n1,n2,n3,n4,n5,n6,n7,n8,…", IndexAuditLog.Cap(nine));
		}

		[Fact]
		public void TheCensusCountsAPlacedPropInTheLens()
		{
			var placed = TestPrefabs.Named(1, "Bench", PrefabCategory.Props, PrefabSubCategory.Props_Misc);
			var unplaced = TestPrefabs.Named(2, "Crate", PrefabCategory.Props, PrefabSubCategory.Props_Misc);
			var road = TestPrefabs.Named(3, "Road", PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			var school = TestPrefabs.Named(4, "School", PrefabCategory.ServiceBuildings, PrefabSubCategory.Any);
			var index = IndexOver(new[] { (1, "Landscaping", "Props") }, Array.Empty<int>(), placed, unplaced, road, school);
			// 99 is not in the index: counted as indexed, never as shown.
			var census = new Dictionary<string, List<int>>
			{
				["Roads"] = new() { 3 },
				["Services"] = new() { 4, 99 },
				["Props"] = new() { 1, 2 },
			};

			Assert.Equal(
				new[]
				{
					new AuditLine(AuditSeverity.Info, "[PROCESSOR-CENSUS] Props indexed=2 lens=1"),
					new AuditLine(AuditSeverity.Info, "[PROCESSOR-CENSUS] Roads indexed=1 lens=1"),
					new AuditLine(AuditSeverity.Info, "[PROCESSOR-CENSUS] Services indexed=2 lens=1"),
				},
				IndexAuditLog.ProcessorCensus(census, index));
		}
	}
}
