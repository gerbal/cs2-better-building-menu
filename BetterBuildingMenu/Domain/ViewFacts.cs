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

		/// <summary>The kinds a view's key kind can be, in the order it is picked.</summary>
		private static readonly string[] KeyKinds = { Capacity, Speed, Workers, Lot };

		/// <summary>
		/// The facts of a whole result: each kind's value that <paramref name="saidOnceAt"/> percent or more of
		/// its unlocked rows share, none in a search or for the kind sorted by; and the key kind, capacity where
		/// half the rows carry one, else the first of speed, workers and lot that half carry.
		/// </summary>
		/// <remarks>One pass over the result, as it runs on every refresh over every match.</remarks>
		public static ViewFacts Of(IReadOnlyList<BuildingCatalogEntry> rows, int saidOnceAt, bool searching, string? sortColumn)
		{
			if (rows.Count == 0)
			{
				return None;
			}

			var counting = !searching && saidOnceAt > 0;
			var sorted = SortedKind(sortColumn);
			var carried = new int[KeyKinds.Length];
			var tallies = new Tally?[SaidKinds.Length];
			var open = 0;

			foreach (var row in rows)
			{
				for (var at = 0; at < KeyKinds.Length; at++)
				{
					if (Carries(row, KeyKinds[at]))
					{
						carried[at]++;
					}
				}

				if (!counting || row.IsLocked)
				{
					continue;
				}

				open++;
				for (var at = 0; at < SaidKinds.Length; at++)
				{
					var kind = SaidKinds[at];
					if (kind != sorted && Carries(row, kind))
					{
						(tallies[at] ??= new Tally()).Add(ValueOf(row, kind));
					}
				}
			}

			var keyAt = Array.FindIndex(carried, count => 2 * count >= rows.Count);
			var keyKind = keyAt < 0 ? NoKind : KeyKinds[keyAt];

			if (!counting)
			{
				return new ViewFacts(Array.Empty<SharedValue>(), keyKind);
			}

			var shared = new List<SharedValue>();
			for (var at = 0; at < SaidKinds.Length; at++)
			{
				// The share as the whole percentage the game would show, rounded half to even (Percent.FromFraction).
				if (tallies[at] is { } tally
					&& tally.BestCount >= SaidOnceFloor
					&& Percent.FromFraction((float)tally.BestCount / open) >= saidOnceAt)
				{
					shared.Add(new SharedValue(SaidKinds[at], tally.Best.Value, tally.Best.Depth));
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
			// A pump's, an outlet's or a treatment plant's capacity is its water or sewage capacity.
			"Capacity" or "WaterCapacity" or "SewageCapacity" => Capacity,
			"Workers" => Workers,
			"LotWidth" or "LotDepth" => Lot,
			_ => null,
		};

		/// <summary>One kind's values over the open rows, and the commonest so far.</summary>
		/// <remarks>At a tie the smaller value is the commonest, so the answer never rests on the rows' order.</remarks>
		private sealed class Tally
		{
			private readonly Dictionary<(double Value, int Depth), int> _counts = new();

			public (double Value, int Depth) Best { get; private set; }

			public int BestCount { get; private set; }

			public void Add((double Value, int Depth) value)
			{
				_counts.TryGetValue(value, out var count);
				_counts[value] = ++count;
				if (count > BestCount || (count == BestCount && Smaller(value, Best)))
				{
					Best = value;
					BestCount = count;
				}
			}

			private static bool Smaller((double Value, int Depth) one, (double Value, int Depth) other)
			{
				var byValue = one.Value.CompareTo(other.Value);
				return byValue < 0 || (byValue == 0 && one.Depth < other.Depth);
			}
		}

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
