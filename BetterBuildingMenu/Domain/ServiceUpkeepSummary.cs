using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
#nullable enable
	/// <summary>
	/// What a building costs to run, read the way the game reads it.
	/// </summary>
	/// <remarks>
	/// The ServiceUpkeepData buffer is the authority: BuildingInitializeSystem copies
	/// a ConsumptionData upkeep into it as a Money entry, so summing the buffer never
	/// double-counts and the consumption figure is a fallback for a prefab with none.
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
