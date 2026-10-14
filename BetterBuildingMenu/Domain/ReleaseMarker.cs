using Colossal.Json;

using System.Globalization;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What release.json holds.</summary>
	/// <param name="Version">The file's format: <see cref="ReleaseMarker.Version"/>.</param>
	/// <param name="First">The release that first wrote the file. Kept once written.</param>
	/// <param name="Last">The release that wrote it at the latest load.</param>
	/// <param name="StampBefore">
	/// Whether the silhouettes stamp existed before the first release that wrote the file ran.
	/// Kept once written: every later load finds a stamp its own cache wrote.
	/// </param>
	public sealed record ReleaseMarkerData(int Version, string First, string Last, bool StampBefore);

	public enum ReleaseMarkerState
	{
		/// <summary>No file.</summary>
		Absent,

		/// <summary>A marker this release reads.</summary>
		Read,

		/// <summary>Not a marker: replaced.</summary>
		Corrupt,

		/// <summary>A marker in a later format: left as it is.</summary>
		Newer,
	}

	public readonly record struct ReleaseMarkerRead(ReleaseMarkerState State, ReleaseMarkerData? Data);

	/// <summary>
	/// The file in ModsData that says which releases have loaded on this computer, so a
	/// later release can tell a player who upgraded from one who installed it fresh.
	/// </summary>
	/// <remarks>
	/// Pure: <see cref="Utilities.ReleaseMarkerFile"/> reads and writes the file. See
	/// docs/design-notes.md, "The release marker and the settings version".
	/// </remarks>
	public static class ReleaseMarker
	{
		public const int Version = 1;

		public const string FileName = "release.json";

		/// <summary>An assembly version as the marker records a release: three parts, as a later release compares them.</summary>
		public static string ReleaseOf(System.Version? version) =>
			version is null ? "0.0.0" : $"{version.Major}.{version.Minor}.{Math.Max(version.Build, 0)}";

		/// <summary>Whether one release is earlier than another, by its numbers.</summary>
		/// <remarks>A release that is not one to three whole numbers is earlier than nothing and later than nothing.</remarks>
		public static bool IsBefore(string? release, string other)
		{
			if (!TryParts(release, out var mine) || !TryParts(other, out var theirs))
			{
				return false;
			}

			for (var i = 0; i < mine.Length; i++)
			{
				if (mine[i] != theirs[i])
				{
					return mine[i] < theirs[i];
				}
			}

			return false;
		}

		private static bool TryParts(string? release, out int[] parts)
		{
			parts = new int[3];
			var pieces = release?.Trim().Split('.') ?? Array.Empty<string>();

			if (pieces.Length < 1 || pieces.Length > parts.Length)
			{
				return false;
			}

			for (var i = 0; i < pieces.Length; i++)
			{
				if (!int.TryParse(pieces[i], NumberStyles.None, CultureInfo.InvariantCulture, out parts[i]))
				{
					return false;
				}
			}

			return true;
		}

		/// <summary>The marker in this text, or null for no file.</summary>
		public static ReleaseMarkerRead Read(string? json)
		{
			if (json is null)
			{
				return new ReleaseMarkerRead(ReleaseMarkerState.Absent, null);
			}

			var corrupt = new ReleaseMarkerRead(ReleaseMarkerState.Corrupt, null);

			try
			{
				if (JSON.Load(json) is not ProxyObject root
					|| !root.TryGetValue("version", out var version)
					|| version is not ProxyNumber)
				{
					return corrupt;
				}

				var format = version.ToDouble(CultureInfo.InvariantCulture);

				if (format > Version)
				{
					return new ReleaseMarkerRead(ReleaseMarkerState.Newer, null);
				}

				if (format != Version
					|| !root.TryGetValue("first", out var first) || first is not ProxyString
					|| !root.TryGetValue("last", out var last) || last is not ProxyString
					|| !root.TryGetValue("stampBefore", out var stampBefore) || stampBefore is not ProxyBoolean)
				{
					return corrupt;
				}

				var firstRelease = first.ToString(CultureInfo.InvariantCulture);
				var lastRelease = last.ToString(CultureInfo.InvariantCulture);

				if (firstRelease.Trim().Length == 0 || lastRelease.Trim().Length == 0)
				{
					return corrupt;
				}

				return new ReleaseMarkerRead(
					ReleaseMarkerState.Read,
					new ReleaseMarkerData(Version, firstRelease, lastRelease, stampBefore.ToBoolean(CultureInfo.InvariantCulture)));
			}
			catch (Exception)
			{
				// Colossal.Json throws a different exception for each way text is not JSON.
				return corrupt;
			}
		}

		/// <summary>The marker this load writes, or null to leave the file as it is.</summary>
		/// <param name="existing">The file, as <see cref="Read"/> found it.</param>
		/// <param name="release">This release, from <see cref="ReleaseOf"/>.</param>
		/// <param name="stampExists">Whether the silhouettes stamp exists now, before this load's cache writes it.</param>
		public static ReleaseMarkerData? Merge(ReleaseMarkerRead existing, string release, bool stampExists)
		{
			if (existing.State == ReleaseMarkerState.Newer)
			{
				return null;
			}

			return existing.State == ReleaseMarkerState.Read && existing.Data is { } kept
				? kept with { Last = release }
				: new ReleaseMarkerData(Version, release, release, stampExists);
		}

		public static string Write(ReleaseMarkerData marker)
		{
			var root = new ProxyObject();
			root.Add("version", new ProxyNumber(marker.Version));
			root.Add("first", new ProxyString(marker.First));
			root.Add("last", new ProxyString(marker.Last));
			root.Add("stampBefore", new ProxyBoolean(marker.StampBefore));

			return JSON.Dump(root);
		}
	}
}
