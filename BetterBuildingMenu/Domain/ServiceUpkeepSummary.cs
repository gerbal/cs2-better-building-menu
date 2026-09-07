using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
#nullable enable
	/// <summary>
	/// What a building costs to run, read the way the game reads it.
	/// </summary>
	/// <remarks>
	/// The ServiceUpkeepData buffer is the authority. BuildingInitializeSystem
	/// copies a ConsumptionData upkeep INTO it as a Money entry — and warns when
	/// a prefab carries money in both — so summing the buffer's money never
	/// double-counts, and the consumption figure is only a fallback for a prefab
	/// that has no buffer at all. Every other resource in the buffer is what the
	/// building burns; vanilla prices it into one money figure at market rate,
	/// this names it.
	/// </remarks>
	public static class ServiceUpkeepSummary
	{
		public const string ResourceFactPrefix = "upkeep:";

		public readonly record struct Result(int Money, (string Resource, int Amount)[] Resources);

		public static Result Summarise(int consumptionUpkeep, IEnumerable<(string Resource, int Amount)> buffer)
		{
			var money = 0;
			var sawMoney = false;
			var resources = new List<(string, int)>();

			foreach (var (resource, amount) in buffer)
			{
				if (resource == "Money")
				{
					sawMoney = true;
					money += amount;
				}
				else if (amount > 0)
				{
					resources.Add((resource, amount));
				}
			}

			return new Result(sawMoney ? money : consumptionUpkeep, resources.ToArray());
		}
	}
}
