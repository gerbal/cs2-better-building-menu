using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// What a transit asset is for: the track, the stop, the station, the depot.
	/// </summary>
	/// <remarks>
	/// The Transportation menu files all of these under one service, so a mode's tab
	/// mixes the depot that runs its vehicles with the stations they call at. Read off
	/// the components vanilla authors each kind with, as <see cref="BuildingRole"/> is.
	/// </remarks>
	public static class TransitRole
	{
		public const string Track = "Track";
		public const string Station = "TransportStation";
		public const string CargoStation = "CargoStation";
		public const string Depot = "TransportDepot";
		public const string Stop = "TransportStop";

		/// <summary>Every transit role, in the order the Transportation menu lists them.</summary>
		/// <remarks>
		/// The order a mode is built in: the track, then where passengers board, then the
		/// depot that runs the vehicles, then freight.
		/// </remarks>
		public static readonly IReadOnlyList<string> All = new[] { Track, Station, Stop, Depot, CargoStation };

		/// <summary>The transit role a prefab plays, or null when it plays none.</summary>
		/// <remarks>
		/// A station before a depot: a building that is both is found by where passengers
		/// board. A road that carries tram tracks is a road, so it is no track.
		/// </remarks>
		public static string? Of(PrefabSnapshot snapshot)
		{
			if (snapshot.TransportStationData.HasValue)
			{
				return snapshot.IsCargoStation ? CargoStation : Station;
			}

			if (snapshot.TransportDepotData.HasValue)
			{
				return Depot;
			}

			if (snapshot.TransportStopData.HasValue && !snapshot.NetData.HasValue)
			{
				return Stop;
			}

			if (snapshot.TrackData is { } track
				&& track.m_TrackType != Game.Net.TrackTypes.None
				&& !snapshot.RoadData.HasValue)
			{
				return Track;
			}

			return null;
		}

		/// <summary>The rank of a transit role in <see cref="All"/>, or -1.</summary>
		public static int RankOf(string? role)
		{
			for (int index = 0; index < All.Count; index++)
			{
				if (string.Equals(All[index], role?.Trim(), System.StringComparison.Ordinal))
				{
					return index;
				}
			}

			return -1;
		}
	}
}
