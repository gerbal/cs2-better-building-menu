using System.Linq;
using FindItBuildingMenu.Domain;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// cm-e98i's third acceptance criterion: the mapping from a vanilla toolbar
	/// section to what the lens shows is covered by tests, not only by a runtime
	/// census.
	/// </summary>
	/// <remarks>
	/// The census these replace reported the real numbers correctly for a week
	/// and could still not stop a regression, because reading it meant booting a
	/// developed save and grepping Modding.log. The fixtures below are shaped
	/// like the live run they were extracted from (see VanillaMenuAudit's
	/// remarks) but stay small enough to name what each one is asserting.
	/// </remarks>
	public sealed class VanillaMenuAuditTests
	{
		private static VanillaMenuPlacementFact Places(int id, string name, string menu, string category = "Cat") =>
			new(id, name, menu, category);

		private static IndexedMenuFact Ours(int id, string name, string menu, bool isServiceUpgrade = false) =>
			new(id, name, menu, isServiceUpgrade);

		private static VanillaMenuAuditReport Compare(
			VanillaMenuPlacementFact[] vanilla,
			IndexedMenuFact[] ours,
			int[]? held = null,
			string[]? substituted = null) =>
			VanillaMenuAudit.Compare(
				vanilla,
				ours,
				held ?? ours.Select(entry => entry.EntityIndex).ToArray(),
				substituted ?? System.Array.Empty<string>());

		[Fact]
		public void AMenuWeCoverCompletelyIsClean()
		{
			var report = Compare(
				new[] { Places(1, "Alley", "Roads"), Places(2, "Gravel Road", "Roads") },
				new[] { Ours(1, "Alley", "Roads"), Ours(2, "Gravel Road", "Roads") });

			Assert.True(report.IsClean);

			var roads = Assert.Single(report.Menus);
			Assert.Equal("Roads", roads.Menu);
			Assert.Equal(2, roads.VanillaPlaces);
			Assert.Equal(2, roads.Held);
			Assert.Equal(2, roads.Ours);
			Assert.Empty(roads.Missing);
		}

		[Fact]
		public void AnAssetVanillaPlacesAndWeDoNotHoldIsNamed()
		{
			// The failure the whole audit exists for: the player clicks Roads and
			// the lens is short something the vanilla menu offers. Named rather
			// than counted, because "missing=1" says a regression happened and the
			// name says which walk stopped seeing it.
			var report = Compare(
				new[] { Places(1, "Alley", "Roads"), Places(2, "Gravel Road", "Roads") },
				new[] { Ours(1, "Alley", "Roads") });

			Assert.False(report.IsClean);

			var roads = Assert.Single(report.Menus);
			Assert.Equal(1, roads.Held);
			Assert.Equal(new[] { "Gravel Road" }, roads.Missing);
		}

		[Fact]
		public void HoldingAnAssetOutsideTheMenuStillCountsAsHeld()
		{
			// Held is "do we have it at all", not "do we file it under this menu".
			// Zones are the case that forced the distinction: the game places them
			// under Zones, and we hold them in a separate catalog.
			var report = Compare(
				new[] { Places(1, "Residential Low", "Zones") },
				ours: System.Array.Empty<IndexedMenuFact>(),
				held: new[] { 1 });

			var zones = Assert.Single(report.Menus);
			Assert.Equal(1, zones.Held);
			Assert.Empty(zones.Missing);
			Assert.Equal(0, zones.Ours);
		}

		[Fact]
		public void ASubstitutedAssetCountsAsHeldUnderItsOwnName()
		{
			// A quantity or vehicle prop is replaced rather than dropped: the
			// generators split it into one asset per state and record the swap in
			// AssetMap, so the player gets MORE than vanilla offers. Counting the
			// original as a gap reported eight phantom losses in Landscaping, and
			// a report that cries wolf is one nobody reads.
			var report = Compare(
				new[] { Places(1, "Tree01", "Landscaping") },
				ours: System.Array.Empty<IndexedMenuFact>(),
				held: System.Array.Empty<int>(),
				substituted: new[] { "Tree01" });

			Assert.True(report.IsClean);
			Assert.Empty(Assert.Single(report.Menus).Missing);
		}

		[Fact]
		public void AServiceUpgradeWeIndexButVanillaDoesNotPlaceIsAnExpectedExtra()
		{
			// The one recorded divergence. The game runs FilterOutUpgrades over
			// every menu because an upgrade is placed from its parent building's
			// row; we match that in the list but keep them indexed so the parent
			// can still name them. Live, this is exactly six assets.
			var report = Compare(
				new[] { Places(1, "Crematorium01", "Health & Deathcare") },
				new[]
				{
					Ours(1, "Crematorium01", "Health & Deathcare"),
					Ours(2, "Crematorium01 Hearse Garage", "Health & Deathcare", isServiceUpgrade: true),
				});

			// Expected, so it does not make the report dirty.
			Assert.True(report.IsClean);

			var health = Assert.Single(report.Menus);
			Assert.Equal(new[] { "Crematorium01 Hearse Garage" }, health.ExpectedExtras);
			Assert.Empty(health.UnexplainedExtras);
		}

		[Fact]
		public void AnExtraNoDivergenceExplainsIsReportedAsUnexplained()
		{
			// The counterpart to the test above, and the reason the divergence is
			// a rule rather than a list of six names: something we offer that
			// vanilla does not place, with no reason on record, is either a new
			// divergence to write down or a bug. It must not pass quietly.
			var report = Compare(
				new[] { Places(1, "Crematorium01", "Health & Deathcare") },
				new[]
				{
					Ours(1, "Crematorium01", "Health & Deathcare"),
					Ours(2, "Area Hub", "Health & Deathcare"),
				});

			Assert.False(report.IsClean);

			var health = Assert.Single(report.Menus);
			Assert.Equal(new[] { "Area Hub" }, health.UnexplainedExtras);
			Assert.Empty(health.ExpectedExtras);
		}

		[Fact]
		public void AMenuNameVanillaHasNoMenuForIsReported()
		{
			// Four unbuildable "Area Hub" zones and six theme-less base zones sat
			// in the surface until a player tried to build one, because nothing
			// asked the reverse question. A menu name the game does not have is
			// one nothing can ever open.
			var report = Compare(
				new[] { Places(1, "Alley", "Roads") },
				new[] { Ours(1, "Alley", "Roads"), Ours(2, "Invented", "Our Own Menu") });

			Assert.False(report.IsClean);
			Assert.Equal(new[] { "Our Own Menu" }, report.InventedMenus);
		}

		[Fact]
		public void EntriesWithNoMenuNameAreNotCountedAsOurs()
		{
			// Most of the index has no menu name at all — live, 17952 indexed
			// assets against 840 placements. Counting those as ours would make
			// every menu look like it had thousands of extras.
			var report = Compare(
				new[] { Places(1, "Alley", "Roads") },
				new[] { Ours(1, "Alley", "Roads"), Ours(2, "Some Prop", string.Empty) });

			Assert.True(report.IsClean);
			Assert.Equal(1, report.IndexedCount);
			Assert.Equal(1, Assert.Single(report.Menus).Ours);
		}

		[Fact]
		public void CategoriesAreCountedDistinctlyPerMenu()
		{
			// The subcategory row is cm-e98i's second half, so the count of
			// categories per menu is part of the same contract: Transportation
			// draws six tabs live, and it draws them from this.
			var report = Compare(
				new[]
				{
					Places(1, "Bus Stop", "Transportation", "Bus"),
					Places(2, "Bus Depot", "Transportation", "Bus"),
					Places(3, "Train Station", "Transportation", "Train"),
				},
				new[]
				{
					Ours(1, "Bus Stop", "Transportation"),
					Ours(2, "Bus Depot", "Transportation"),
					Ours(3, "Train Station", "Transportation"),
				});

			Assert.Equal(2, Assert.Single(report.Menus).Categories);
		}

		[Fact]
		public void MenusAreReportedInAStableOrder()
		{
			// The report is read by eye against the previous boot's, so the order
			// has to be the same both times or the diff is unreadable.
			var report = Compare(
				new[]
				{
					Places(1, "Train Station", "Transportation"),
					Places(2, "Alley", "Roads"),
					Places(3, "Park", "Parks & Recreation"),
				},
				new[]
				{
					Ours(1, "Train Station", "Transportation"),
					Ours(2, "Alley", "Roads"),
					Ours(3, "Park", "Parks & Recreation"),
				});

			Assert.Equal(
				new[] { "Parks & Recreation", "Roads", "Transportation" },
				report.Menus.Select(line => line.Menu).ToArray());
		}

		[Fact]
		public void APlacementWithNoMenuIsFiledRatherThanDropped()
		{
			// The walk can return a placement whose menu it could not resolve.
			// Dropping it would shrink the placement count and hide the failure;
			// it gets a name instead.
			var report = Compare(
				new[] { new VanillaMenuPlacementFact(1, "Orphan", null!, "Cat") },
				new[] { Ours(1, "Orphan", "Roads") });

			Assert.Equal("(none)", Assert.Single(report.Menus).Menu);
			Assert.Equal(1, report.PlacementCount);
		}
	}
}
