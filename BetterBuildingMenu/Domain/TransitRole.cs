using System.Collections.Generic;

using Game.Prefabs;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// What a transit asset is for: the station, the stop, the depot.
	/// </summary>
	/// <remarks>
	/// The Transportation menu files all of these under one service, so a mode's tab
	/// mixes the depot that runs its vehicles with the stations they call at. Read off
	/// the components vanilla authors each kind with, as <see cref="BuildingRole"/> is.
	/// A track is a network, not a building, and is told apart by its subcategory.
	/// See docs/design-notes.md, "Transit tiers".
	/// </remarks>
	public static class TransitRole
	{
		public const string Station = "TransportStation";
		public const string CargoStation = "CargoStation";
		public const string Depot = "TransportDepot";
		public const string Stop = "TransportStop";

		/// <summary>Every transit role the indexer can produce.</summary>
		public static readonly IReadOnlyList<string> All = new[] { Station, Stop, Depot, CargoStation };

		/// <summary>The transit role a prefab plays, or null when it plays none.</summary>
		/// <remarks>
		/// Passengers before freight and a station before a depot: a building that is both
		/// is found by where passengers board.
		/// </remarks>
		public static string? Of(PrefabSnapshot snapshot)
		{
			if (snapshot.TransportStationData.HasValue)
			{
				return snapshot.IsCargoStation && !snapshot.IsPublicTransportStation ? CargoStation : Station;
			}

			if (snapshot.TransportDepotData.HasValue)
			{
				return Depot;
			}

			if (snapshot.TransportStopData is { } stop
				&& !snapshot.NetData.HasValue
				&& stop.m_PassengerTransport
				&& IsPublicTransport(stop.m_TransportType))
			{
				return Stop;
			}

			return null;
		}

		/// <summary>
		/// The kinds a passenger line runs on. A mailbox, a parking space and an industry's
		/// work stop carry stop data too, for post, cars and freight, and are no transit stop.
		/// </summary>
		private static bool IsPublicTransport(TransportType type) =>
			type is TransportType.Bus
				or TransportType.Train
				or TransportType.Taxi
				or TransportType.Tram
				or TransportType.Ship
				or TransportType.Ferry
				or TransportType.Helicopter
				or TransportType.Airplane
				or TransportType.Subway;
	}
}
