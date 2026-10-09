using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// Finds a vector icon on disk, blackens it once, and serves it from our host.
	/// </summary>
	/// <remarks>
	/// See <see cref="SilhouetteIcons"/> for why the silhouette is baked into
	/// the artwork rather than applied as a filter. Roots and cache directory
	/// are injected so this is testable; Mod.OnLoad wires the real ones.
	/// </remarks>
	public sealed class SilhouetteIconCache
	{
		/// <summary>The cache's folder, under ModsData.</summary>
		public const string FolderName = "silhouettes";

		/// <summary>The file that names the transform the cache was written with.</summary>
		/// <remarks>Written at every load, so the release marker reads whether it exists first.</remarks>
		public const string StampFileName = ".stamp";

		private readonly IReadOnlyList<string> _contentRoots;
		private readonly string _cacheDirectory;

		// Both outcomes are cached: without a remembered miss, every projection
		// re-walks the content roots for an icon that is not there, and the
		// projection runs on every refresh.
		private readonly Dictionary<string, string?> _resolved =
			new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

		/// <summary>
		/// The cache directory's contents, listed once instead of stat'd per icon.
		/// </summary>
		/// <remarks>
		/// One listing answers every icon, instead of a File.Exists for each on
		/// the first visit to a menu. Null until first use, so a mod that
		/// never shows a locked vector asset never pays for it.
		/// </remarks>
		private HashSet<string>? _cachedFiles;

		public SilhouetteIconCache(IReadOnlyList<string> contentRoots, string cacheDirectory)
		{
			_contentRoots = contentRoots ?? throw new ArgumentNullException(nameof(contentRoots));
			_cacheDirectory = cacheDirectory ?? throw new ArgumentNullException(nameof(cacheDirectory));

			DiscardStaleCache();
		}

		/// <summary>Throw the cache away when it was written by a different transform.</summary>
		/// <remarks>
		/// The files persist across restarts on purpose, so nothing regenerates
		/// once they exist; the stamp is what lets the transform change.
		/// </remarks>
		private void DiscardStaleCache()
		{
			var stampFile = Path.Combine(_cacheDirectory, StampFileName);

			try
			{
				if (File.Exists(stampFile)
					&& string.Equals(File.ReadAllText(stampFile).Trim(), SilhouetteIcons.CacheStamp, StringComparison.Ordinal))
				{
					return;
				}

				if (Directory.Exists(_cacheDirectory))
				{
					foreach (var stale in Directory.GetFiles(_cacheDirectory, "*.svg"))
					{
						File.Delete(stale);
					}
				}

				Directory.CreateDirectory(_cacheDirectory);
				File.WriteAllText(stampFile, SilhouetteIcons.CacheStamp);
			}
			catch (Exception)
			{
				// Same reasoning as Generate: a locked-state nicety must not
				// take a menu down. A cache we failed to clear regenerates
				// nothing and the old files still draw.
			}
		}

		/// <summary>How many icons have been blackened this session.</summary>
		public int Generated { get; private set; }

		/// <summary>
		/// The URL of a black copy of this icon, or null when there is none to make.
		/// </summary>
		public string? UrlFor(string thumbnail)
		{
			if (!SilhouetteIcons.IsVector(thumbnail))
			{
				return null;
			}

			var relative = thumbnail.Split('?', '#')[0].Trim();

			if (_resolved.TryGetValue(relative, out var cached))
			{
				return cached;
			}

			var url = Generate(relative);
			_resolved[relative] = url;

			return url;
		}

		private string? Generate(string relative)
		{
			var fileName = SilhouetteIcons.CacheFileName(relative);
			var target = Path.Combine(_cacheDirectory, fileName);

			// Survives a restart: the file is as good as the install it came
			// from, and regenerating every icon on each boot would be waste.
			// One directory listing answers this; see _cachedFiles.
			if (CachedFiles().Contains(fileName))
			{
				return SilhouetteIcons.UrlFor(relative);
			}

			var source = FindSource(relative);

			if (source is null)
			{
				return null;
			}

			try
			{
				Directory.CreateDirectory(_cacheDirectory);
				File.WriteAllText(target, SilhouetteIcons.Blacken(File.ReadAllText(source)));
				CachedFiles().Add(fileName);
				Generated++;
			}
			catch (Exception)
			{
				// A locked-state nicety is not worth failing a menu over: the
				// entry falls back to its normal thumbnail, which still carries
				// the dimmed ground and the padlock.
				return null;
			}

			return SilhouetteIcons.UrlFor(relative);
		}

		/// <summary>The cache directory's file names, listed at most once.</summary>
		private HashSet<string> CachedFiles()
		{
			if (_cachedFiles is not null)
			{
				return _cachedFiles;
			}

			_cachedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

			try
			{
				if (Directory.Exists(_cacheDirectory))
				{
					foreach (var path in Directory.GetFiles(_cacheDirectory, "*.svg"))
					{
						_cachedFiles.Add(Path.GetFileName(path));
					}
				}
			}
			catch (Exception)
			{
				// An unreadable cache directory means every icon regenerates,
				// which is slow rather than broken. Same posture as Generate.
			}

			return _cachedFiles;
		}

		private string? FindSource(string relative)
		{
			var normalized = relative.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);

			return _contentRoots
				.Select(root => Path.Combine(root, normalized))
				.FirstOrDefault(File.Exists);
		}
	}
}
