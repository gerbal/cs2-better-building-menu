using BetterBuildingMenu.Domain;

using System.IO;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>Reads, merges and writes release.json.</summary>
	/// <remarks>
	/// Mod.OnLoad calls it first, before the silhouette cache writes its stamp. The folder is
	/// a parameter, so a test can hand it one that cannot be written.
	/// </remarks>
	public static class ReleaseMarkerFile
	{
		/// <summary>Moves the marker to this release. Never throws: a failure is one warning.</summary>
		/// <returns>What was written, or null when nothing was.</returns>
		public static ReleaseMarkerData? Update(string folder, string release, Action<string> warn)
		{
			try
			{
				var (existing, stampExists) = ReadFolder(folder);

				if (existing.State == ReleaseMarkerState.Corrupt)
				{
					warn($"{ReleaseMarker.FileName} is not a marker this release can read; writing a new one");
				}

				if (ReleaseMarker.Merge(existing, release, stampExists) is not { } marker)
				{
					return null;
				}

				Directory.CreateDirectory(folder);
				AtomicFile.WriteAllText(Path.Combine(folder, ReleaseMarker.FileName), ReleaseMarker.Write(marker));

				return marker;
			}
			catch (Exception ex)
			{
				warn($"Could not update {ReleaseMarker.FileName}: {ex.Message}");

				return null;
			}
		}

		/// <summary>What the folder held before this load writes the marker or the stamp. Never throws.</summary>
		/// <remarks>
		/// Read first in OnLoad. A folder that cannot be read reads as nothing, silently: the marker
		/// update that follows meets the same folder and warns.
		/// </remarks>
		public static PriorInstall ReadPrior(string folder)
		{
			try
			{
				var (marker, stampExists) = ReadFolder(folder);

				return PriorInstall.From(marker, stampExists);
			}
			catch (Exception)
			{
				return PriorInstall.Nothing;
			}
		}

		/// <summary>The marker as the file holds it, and whether the silhouettes stamp exists.</summary>
		private static (ReleaseMarkerRead Marker, bool StampExists) ReadFolder(string folder)
		{
			var stampExists = File.Exists(Path.Combine(folder, SilhouetteIconCache.FolderName, SilhouetteIconCache.StampFileName));
			var path = Path.Combine(folder, ReleaseMarker.FileName);

			return (ReleaseMarker.Read(File.Exists(path) ? File.ReadAllText(path) : null), stampExists);
		}
	}
}
