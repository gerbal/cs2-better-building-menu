using Game.Prefabs;

using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>How many passenger stops of each kind a building holds.</summary>
	public sealed record TransportStopCounts(int Airplane, int Helicopter, int Ship, int Subway, int Tram, int Train, int Bus)
	{
		/// <summary>The counts vanilla's tooltip shows for a building's stops, or null when it shows
		/// none.</summary>
		/// <param name="stops">Each sub-object's stop, in the building's order, leaving out the
		/// sub-objects that are not stops.</param>
		/// <remarks>TransportStopBinder, transcribed: the first stop decides whether there is a line
		/// at all, so a building whose first stop takes no passengers shows none, whatever follows it.
		/// Then every passenger stop is counted by kind. A network shows none either, which the
		/// caller checks.</remarks>
		public static TransportStopCounts? Of(IReadOnlyList<TransportStopData> stops)
		{
			if (stops.Count == 0 || !stops[0].m_PassengerTransport || !IsCounted(stops[0].m_TransportType))
			{
				return null;
			}

			int airplane = 0, helicopter = 0, ship = 0, subway = 0, tram = 0, train = 0, bus = 0;

			foreach (var stop in stops)
			{
				if (!stop.m_PassengerTransport)
				{
					continue;
				}

				switch (stop.m_TransportType)
				{
					case TransportType.Airplane: airplane++; break;
					case TransportType.Helicopter: helicopter++; break;
					case TransportType.Ship: ship++; break;
					case TransportType.Subway: subway++; break;
					case TransportType.Tram: tram++; break;
					case TransportType.Train: train++; break;
					case TransportType.Bus: bus++; break;
				}
			}

			return new TransportStopCounts(airplane, helicopter, ship, subway, tram, train, bus);
		}

		private static bool IsCounted(TransportType type) =>
			type is TransportType.Bus
				or TransportType.Train
				or TransportType.Tram
				or TransportType.Ship
				or TransportType.Helicopter
				or TransportType.Airplane
				or TransportType.Subway;
	}
}
