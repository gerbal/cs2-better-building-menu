using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// What a page says of its whole view, the tab or All with the filters, or a search's result: the
	/// values the readout says once, and the kind of number each row's second number shows.
	/// </summary>
	/// <remarks>
	/// Counted over the whole result, as the UI only ever sees a window of it. See docs/design-notes.md,
	/// "Numbers said once".
	/// </remarks>
	public sealed record ViewFacts(IReadOnlyList<SharedValue> SharedValues, string KeyKind) : IJsonWritable
	{
		/// <summary>A network's speed limit, in whole km/h.</summary>
		public const string Speed = "speed";

		/// <summary>The headline capacity.</summary>
		public const string Capacity = "capacity";

		/// <summary>The workplaces.</summary>
		public const string Workers = "workers";

		/// <summary>The lot, its width by its depth.</summary>
		public const string Lot = "lot";

		/// <summary>The construction cost, a network's per distance.</summary>
		public const string Cost = "cost";

		/// <summary>No kind: the rows show no second number.</summary>
		public const string NoKind = "";

		/// <summary>The fewest rows a value said once must save printing: a statement in the readout costs more than two numbers.</summary>
		public const int SaidOnceFloor = 3;

		/// <summary>A view that says nothing: no row, or a page built without facts.</summary>
		public static readonly ViewFacts None = new(Array.Empty<SharedValue>(), NoKind);

		/// <summary>The kinds a value is said once for, in the readout's order.</summary>
		private static readonly string[] SaidKinds = { Speed, Capacity, Workers, Lot, Cost };

		/// <summary>
		/// The facts of a whole result: each kind's value that <paramref name="saidOnceAt"/> percent or more of
		/// its unlocked rows share, none in a search or for the kind sorted by; and the key kind, capacity where
		/// half the rows carry one, else the first of speed, workers and lot that half carry.
		/// </summary>
		public static ViewFacts Of(IReadOnlyList<BuildingCatalogEntry> rows, int saidOnceAt, bool searching, string? sortColumn)
		{
			if (rows.Count == 0)
			{
				return None;
			}

			var keyKind = new[] { Capacity, Speed, Workers, Lot }.FirstOrDefault(kind => 2 * rows.Count(row => Carries(row, kind)) >= rows.Count) ?? NoKind;

			if (searching || saidOnceAt <= 0)
			{
				return new ViewFacts(Array.Empty<SharedValue>(), keyKind);
			}

			var open = rows.Where(row => !row.IsLocked).ToArray();
			var sorted = SortedKind(sortColumn);
			var shared = new List<SharedValue>();

			foreach (var kind in SaidKinds)
			{
				if (kind == sorted || open.Length == 0)
				{
					continue;
				}

				// The commonest value; at a tie, the smaller, so the answer never rests on the rows' order.
				var common = open
					.Where(row => Carries(row, kind))
					.GroupBy(row => ValueOf(row, kind))
					.OrderByDescending(group => group.Count())
					.ThenBy(group => group.Key.Value)
					.ThenBy(group => group.Key.Depth)
					.FirstOrDefault();

				// The share as the whole percentage the game would show, rounded half to even (Percent.FromFraction).
				if (common is not null
					&& common.Count() >= SaidOnceFloor
					&& Percent.FromFraction((float)common.Count() / open.Length) >= saidOnceAt)
				{
					shared.Add(new SharedValue(kind, common.Key.Value, common.Key.Depth));
				}
			}

			return new ViewFacts(shared, keyKind);
		}

		/// <summary>Whether a row has a value of this kind to show: a speed, capacity or workers above 0, a lot with both sides, a known cost.</summary>
		public static bool Carries(BuildingCatalogEntry row, string kind) => kind switch
		{
			Speed => row.SpeedLimit is > 0,
			Capacity => row.Capacity is > 0,
			Workers => row.Workers is > 0,
			Lot => row.LotWidth > 0 && row.LotDepth > 0,
			Cost => row.ConstructionCost.HasValue,
			_ => false,
		};

		/// <summary>A row's value of a kind as the rows print it: a speed in whole km/h, a lot as its two sides.</summary>
		private static (double Value, int Depth) ValueOf(BuildingCatalogEntry row, string kind) => kind switch
		{
			Speed => (Math.Round(row.SpeedLimit ?? 0), 0),
			Capacity => (row.Capacity ?? 0, 0),
			Workers => (row.Workers ?? 0, 0),
			Lot => (row.LotWidth, row.LotDepth),
			_ => (row.ConstructionCost ?? 0, 0),
		};

		/// <summary>The kind a sort orders by, whose value every row then prints; null for a sort by none of them.</summary>
		private static string? SortedKind(string? sortColumn) => sortColumn switch
		{
			"ConstructionCost" => Cost,
			"Capacity" => Capacity,
			"Workers" => Workers,
			"LotWidth" or "LotDepth" => Lot,
			_ => null,
		};

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("sharedValues");
			writer.ArrayBegin((uint)SharedValues.Count);
			foreach (var value in SharedValues)
			{
				value.Write(writer);
			}
			writer.ArrayEnd();
			writer.PropertyName("keyKind");
			writer.Write(KeyKind);
			writer.TypeEnd();
		}
	}

	/// <summary>A value the readout says once: its kind, and the value, or for a lot its width with its depth.</summary>
	public sealed record SharedValue(string Kind, double Value, int Depth) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("kind");
			writer.Write(Kind);
			writer.PropertyName("value");
			writer.Write(Value);
			writer.PropertyName("depth");
			writer.Write(Depth);
			writer.TypeEnd();
		}
	}
}
