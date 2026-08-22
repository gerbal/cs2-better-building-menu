using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace FindItBuildingMenu.Utilities
{
	/// <summary>
	/// Finds a vector icon on disk, blackens it once, and serves it from our host.
	/// </summary>
	/// <remarks>
	/// See <see cref="SilhouetteIcons"/> for why the silhouette has to be baked
	/// into the artwork rather than applied as a filter.
	///
	/// Roots and cache directory are injected so this is testable against temp
	/// directories; the game wires the real ones in Mod.OnLoad.
	/// </remarks>
	public sealed class SilhouetteIconCache
	{
		private readonly IReadOnlyList<string> _contentRoots;
		private readonly string _cacheDirectory;

		// Both outcomes are cached. A miss is as worth remembering as a hit:
		// without it, every projection re-walks the content roots for an icon
		// that was not there the first time, and the projection runs on every
		// refresh.
		private readonly Dictionary<string, string?> _resolved =
			new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

		public SilhouetteIconCache(IReadOnlyList<string> contentRoots, string cacheDirectory)
		{
			_contentRoots = contentRoots ?? throw new ArgumentNullException(nameof(contentRoots));
			_cacheDirectory = cacheDirectory ?? throw new ArgumentNullException(nameof(cacheDirectory));
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
			var target = Path.Combine(_cacheDirectory, SilhouetteIcons.CacheFileName(relative));

			// Survives a restart: the file is as good as the install it came
			// from, and regenerating 500 icons on every boot would be waste.
			if (File.Exists(target))
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

		private string? FindSource(string relative)
		{
			var normalized = relative.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);

			return _contentRoots
				.Select(root => Path.Combine(root, normalized))
				.FirstOrDefault(File.Exists);
		}
	}
}
