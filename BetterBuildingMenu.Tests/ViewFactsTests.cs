using System.Collections;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>What the page says of its whole view: the values said once, and the kind its second number shows.</summary>
	public sealed class ViewFactsTests
	{
		/// <summary>A road with a cost of its own, so no cost is shared unless a test gives one.</summary>
		private static BuildingCatalogEntry Road(int id, double speed, bool locked = false) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Prefab" + id, Name: "Road " + id, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 0, LotDepth: 0, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "", ConstructionCost: 5000 + 250 * id)
			with { UiMenu = "Roads", UiCategory = "RoadsMediumRoads", UIOrder = id, SpeedLimit = speed, CostIsPerDistance = true, IsLocked = locked };

		private static BuildingCatalogEntry School(int id, double? capacity, int lot = 4, double? workers = 20) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "School" + id, Name: "School " + id, Category: "Education", SubCategory: "Education",
				Thumbnail: "", LotWidth: lot, LotDepth: lot, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "", ConstructionCost: 100000, Workers: workers, Capacity: capacity)
			with { UiMenu = "Education", UiCategory = "EducationElementary", UIOrder = id };

		/// <summary>Medium Roads in small: four at 100 km/h of six open rows, one at 80, one at 120, and two locked at 160.</summary>
		private static readonly BuildingCatalogEntry[] MediumRoads =
		{
			Road(1, 100), Road(2, 100), Road(3, 80), Road(4, 100), Road(5, 120.00000762939453), Road(6, 100),
			Road(7, 160, locked: true), Road(8, 160, locked: true),
		};

		[Fact]
		public void ASpeedTwoThirdsOfTheOpenRowsShareIsSaidOnceAndIsTheKeyKind()
		{
			var facts = BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads")).Facts;

			// Four of six open rows hold 100 km/h; the locked rows count for neither side.
			Assert.Equal(ViewFacts.Speed, facts.KeyKind);
			var shared = Assert.Single(facts.SharedValues);
			Assert.Equal((ViewFacts.Speed, 100d, 0), (shared.Kind, shared.Value, shared.Depth));
		}

		[Fact]
		public void TheFactsAreCountedOverTheWholeResultNotTheWindow()
		{
			var page = BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads", Limit: 2));

			Assert.Equal(2, page.Items.Count);
			Assert.Equal(100d, Assert.Single(page.Facts.SharedValues).Value);
		}

		[Fact]
		public void AShareUnderTheKnobsSaysNothingOnceAndOffSaysNothing()
		{
			// Four of six is 67%: the 75% share says none, nor does the knob's off.
			Assert.Empty(BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads", SaidOnceAt: 75)).Facts.SharedValues);
			Assert.Empty(BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads", SaidOnceAt: 0)).Facts.SharedValues);
			Assert.Single(BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads", SaidOnceAt: 60)).Facts.SharedValues);
		}

		[Fact]
		public void ASearchSaysNothingOnceButKeepsItsOwnKeyKind()
		{
			var facts = BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads", SearchText: "road")).Facts;

			Assert.Empty(facts.SharedValues);
			Assert.Equal(ViewFacts.Speed, facts.KeyKind);
		}

		[Fact]
		public void TheKindSortedByIsNeverSaidOnce()
		{
			var rows = MediumRoads.Select(road => road with { ConstructionCost = 4000 }).ToArray();

			var byDefault = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Roads")).Facts;
			var byCost = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Roads", SortColumn: "ConstructionCost")).Facts;

			Assert.Contains(byDefault.SharedValues, value => value.Kind == ViewFacts.Cost && value.Value == 4000);
			Assert.DoesNotContain(byCost.SharedValues, value => value.Kind == ViewFacts.Cost);
			Assert.Contains(byCost.SharedValues, value => value.Kind == ViewFacts.Speed);

			// A pump's or an outlet's capacity is its water or sewage capacity, so a sort by either orders by the capacity.
			var pumps = new[] { School(1, 500), School(2, 500), School(3, 500) }
				.Select(pump => pump with { WaterCapacity = 500, SewageCapacity = 500 })
				.ToArray();
			Assert.Contains(BuildingCatalogQueryEngine.Query(pumps, new BuildingCatalogQuery(UiMenu: "Education")).Facts.SharedValues, value => value.Kind == ViewFacts.Capacity);
			foreach (var column in new[] { "WaterCapacity", "SewageCapacity" })
			{
				var sorted = BuildingCatalogQueryEngine.Query(pumps, new BuildingCatalogQuery(UiMenu: "Education", SortColumn: column)).Facts;
				Assert.DoesNotContain(sorted.SharedValues, value => value.Kind == ViewFacts.Capacity);
			}
		}

		/// <summary>The share is the whole percentage the game would show, rounded half to even: five of eight is 62.5%, so 62.</summary>
		[Theory]
		[InlineData(6, 4, 67, true)]
		[InlineData(6, 4, 68, false)]
		[InlineData(8, 5, 62, true)]
		[InlineData(8, 5, 63, false)]
		public void TheShareIsRoundedAsTheGameRoundsAPercentage(int open, int holding, int saidOnceAt, bool said)
		{
			// The rows past the holders each run at a speed of their own.
			var rows = Enumerable.Range(1, open).Select(id => Road(id, id <= holding ? 100 : 40 + id)).ToArray();

			var facts = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Roads", SaidOnceAt: saidOnceAt)).Facts;

			Assert.Equal(said, facts.SharedValues.Any(value => value.Kind == ViewFacts.Speed));
		}

		[Fact]
		public void AValueFewerThanThreeRowsHoldIsNeverSaidOnce()
		{
			// Two of two is every row, but a statement in the readout costs more than two numbers.
			var facts = BuildingCatalogQueryEngine.Query(MediumRoads.Take(2).ToArray(), new BuildingCatalogQuery(UiMenu: "Roads")).Facts;

			Assert.Empty(facts.SharedValues);
		}

		[Fact]
		public void CapacityIsTheKeyKindWhereHalfTheRowsCarryOneAndALotIsSharedAsItsTwoSides()
		{
			var rows = new[] { School(1, 300), School(2, 300), School(3, null), School(4, 900, lot: 6) };

			var facts = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Education")).Facts;

			Assert.Equal(ViewFacts.Capacity, facts.KeyKind);
			Assert.Contains(facts.SharedValues, value => (value.Kind, value.Value, value.Depth) == (ViewFacts.Lot, 4d, 4));
			Assert.Contains(facts.SharedValues, value => (value.Kind, value.Value) == (ViewFacts.Workers, 20d));
			// Two of four is half, under two thirds.
			Assert.DoesNotContain(facts.SharedValues, value => value.Kind == ViewFacts.Capacity);
		}

		[Fact]
		public void UnderHalfCarryingACapacityTheKeyKindIsTheFirstFactHalfCarryElseNone()
		{
			var workersOnly = new[] { School(1, null, lot: 0), School(2, null, lot: 0), School(3, 300, lot: 0) };
			var nothing = new[] { School(1, null, lot: 0, workers: null), School(2, null, lot: 0, workers: null) };

			Assert.Equal(ViewFacts.Workers, BuildingCatalogQueryEngine.Query(workersOnly, new BuildingCatalogQuery(UiMenu: "Education")).Facts.KeyKind);
			Assert.Equal(ViewFacts.NoKind, BuildingCatalogQueryEngine.Query(nothing, new BuildingCatalogQuery(UiMenu: "Education")).Facts.KeyKind);
		}

		[Fact]
		public void TheCommonestValueIsCountedOverTheOpenRowsAlone()
		{
			// Three open rows at 80 km/h against two at 100; four locked rows at 100 would make 100 the commonest.
			var rows = new[]
			{
				Road(1, 80), Road(2, 80), Road(3, 80), Road(4, 100), Road(5, 100),
				Road(6, 100, locked: true), Road(7, 100, locked: true), Road(8, 100, locked: true), Road(9, 100, locked: true),
			};

			var facts = BuildingCatalogQueryEngine.Query(rows, new BuildingCatalogQuery(UiMenu: "Roads", SaidOnceAt: 60)).Facts;

			var shared = Assert.Single(facts.SharedValues);
			Assert.Equal((ViewFacts.Speed, 80d), (shared.Kind, shared.Value));
		}

		[Fact]
		public void TheRowsAreReadInOnePass()
		{
			var rows = new CountingRows(MediumRoads);

			var facts = ViewFacts.Of(rows, saidOnceAt: 67, searching: false, sortColumn: null);

			Assert.Equal(100d, Assert.Single(facts.SharedValues).Value);
			Assert.Equal((1, 0), (rows.Enumerations, rows.Reads));
		}

		[Fact]
		public void AnEmptyResultSaysNothing()
		{
			var facts = BuildingCatalogQueryEngine.Query(Array.Empty<BuildingCatalogEntry>(), new BuildingCatalogQuery()).Facts;

			Assert.Same(ViewFacts.None, facts);
		}

		[Fact]
		public void ThePageWritesItsFactsForTheUi()
		{
			var writer = new RecordingJsonWriter();

			BuildingCatalogQueryEngine.Query(MediumRoads, new BuildingCatalogQuery(UiMenu: "Roads")).Write(writer);

			Assert.Contains("facts", writer.PropertyNames);
			Assert.Contains("sharedValues", writer.PropertyNames);
			Assert.Contains("keyKind", writer.PropertyNames);
			Assert.Contains("Write:String:speed", writer.Tokens);
		}

		/// <summary>A result that counts how it is read: each enumeration, and each read by index.</summary>
		private sealed class CountingRows : IReadOnlyList<BuildingCatalogEntry>
		{
			private readonly IReadOnlyList<BuildingCatalogEntry> _rows;

			public CountingRows(IReadOnlyList<BuildingCatalogEntry> rows) => _rows = rows;

			public int Enumerations { get; private set; }

			public int Reads { get; private set; }

			public int Count => _rows.Count;

			public BuildingCatalogEntry this[int index]
			{
				get
				{
					Reads++;
					return _rows[index];
				}
			}

			public IEnumerator<BuildingCatalogEntry> GetEnumerator()
			{
				Enumerations++;
				return _rows.GetEnumerator();
			}

			IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
		}
	}
}
