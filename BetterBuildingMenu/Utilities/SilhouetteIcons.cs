using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// Black copies of the game's vector icons, so a locked network can be
	/// silhouetted without a compositing effect.
	/// </summary>
	/// <remarks>
	/// Cohtml re-rasterises a vector at every composite, so vanilla's
	/// brightness(0%) filter is unstable over an SVG thumbnail. The silhouette
	/// is baked into the markup instead, generated from the player's own install.
	/// </remarks>
	public static class SilhouetteIcons
	{
		public const string HostName = "betterbuildingmenusilhouettes";

		/// <summary>Fills and strokes, except the ones that mean "draw nothing".</summary>
		/// <remarks>
		/// `fill="none"` is structural — it is how an SVG says a shape is an outline
		/// rather than a solid — so repainting it black would flood the icon.
		/// </remarks>
		private static readonly Regex PaintAttribute =
			new Regex("(fill|stroke)=\"(?!none\")[^\"]*\"", RegexOptions.IgnoreCase | RegexOptions.Compiled);

		private static readonly Regex PaintStyle =
			new Regex(@"(fill|stroke)\s*:\s*(?!none)[^;""']+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

		/// <summary>The colour vanilla's own silhouette actually lands on.</summary>
		/// <remarks>
		/// Cohtml's brightness(0%) bottoms out short of zero, so matching the
		/// filtered rasters beside these icons means matching that, not #000000.
		/// Changing this value must invalidate the cache; see CacheStamp.
		/// </remarks>
		public const string SilhouetteColor = "#191919";

		/// <summary>What a cache directory must be stamped with to be reused.</summary>
		/// <remarks>
		/// Cached files persist across restarts and nothing regenerates on its own,
		/// so stamping the transform is what lets the tint change.
		/// </remarks>
		public static string CacheStamp => "tint=" + SilhouetteColor;

		/// <summary>Repaint every visible fill and stroke to the silhouette colour.</summary>
		public static string Blacken(string svg)
		{
			if (string.IsNullOrEmpty(svg))
			{
				return svg;
			}

			var painted = PaintAttribute.Replace(svg, match => match.Groups[1].Value + "=\"" + SilhouetteColor + "\"");

			return PaintStyle.Replace(painted, match => match.Groups[1].Value + ":" + SilhouetteColor);
		}

		/// <summary>Whether this thumbnail is a vector, and so needs the swap.</summary>
		public static bool IsVector(string? thumbnail)
		{
			if (thumbnail is null or "")
			{
				return false;
			}

			var path = thumbnail.Split('?', '#')[0];

			return path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase);
		}

		/// <summary>A stable, flat file name for an icon that may live at any depth.</summary>
		/// <remarks>
		/// The host serves one folder, so the directory is flattened; the relative
		/// path stays in the name so two icons called Placeholder.svg cannot collide.
		/// </remarks>
		public static string CacheFileName(string relativePath)
		{
			var trimmed = (relativePath ?? string.Empty).Split('?', '#')[0].Trim();

			return trimmed
				.Replace('\\', '/')
				.Replace(":", string.Empty)
				.Replace("//", "/")
				.Trim('/')
				.Replace('/', '_');
		}

		/// <summary>The URL a blackened copy is served from.</summary>
		public static string UrlFor(string relativePath) =>
			$"coui://{HostName}/{CacheFileName(relativePath)}";
	}
}
