using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;

namespace FindItBuildingMenu.Utilities
{
	/// <summary>
	/// Black copies of the game's vector icons, so a locked network can be
	/// silhouetted without a compositing effect.
	/// </summary>
	/// <remarks>
	/// Vanilla says "you cannot place this" by drawing the thumbnail as a black
	/// silhouette — `filter: grayscale(100%) contrast(80%) brightness(0%)`. That
	/// works over a PNG and is unusable over an SVG: Cohtml rasterises a vector
	/// at draw time, so an effect over one re-rasterises it per composite and
	/// intermittently fails. Measured with 105 asset packs on locked subway
	/// tiles — filtered SVG thumbnails flickered and some never drew at all,
	/// while filtered PNGs beside them were stable. `mask-image` does the same,
	/// and `opacity` makes the icon vanish outright.
	///
	/// Every route that would rasterise inside the engine is closed: canvas
	/// drawImage of an SVG draws nothing, globalCompositeOperation is ignored,
	/// toDataURL and getImageData are absent, appending ?width=&amp;height= still
	/// serves the vector, and XHR cannot read an assetdb URL.
	///
	/// So the silhouette stops being an effect and becomes the artwork: the
	/// icon's own markup with every fill and stroke repainted black, written
	/// once and served as an ordinary &lt;img&gt;. A vector with no effect over it
	/// renders perfectly.
	///
	/// Generated on the player's machine from their own install rather than
	/// shipped, so no game art is redistributed. Written under ModsData and NOT
	/// into the deployed mod folder — the mod file watcher reacts to writes
	/// there by reloading the UI, which killed the running game twice while
	/// this was being investigated.
	/// </remarks>
	public static class SilhouetteIcons
	{
		public const string HostName = "finditsilhouettes";

		/// <summary>Fills and strokes, except the ones that mean "draw nothing".</summary>
		/// <remarks>
		/// `fill="none"` is structural — it is how an SVG says a shape is an
		/// outline rather than a solid — so repainting it black would flood the
		/// icon. Same for `stroke="none"`.
		/// </remarks>
		private static readonly Regex PaintAttribute =
			new Regex("(fill|stroke)=\"(?!none\")[^\"]*\"", RegexOptions.IgnoreCase | RegexOptions.Compiled);

		private static readonly Regex PaintStyle =
			new Regex(@"(fill|stroke)\s*:\s*(?!none)[^;""']+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

		/// <summary>
		/// The colour vanilla's own silhouette actually lands on.
		/// </summary>
		/// <remarks>
		/// Not black, measured rather than assumed: sampling a filtered raster
		/// tile on screen gives rgb(25,25,25), because Cohtml's brightness(0%)
		/// bottoms out short of zero. Painting these #000000 left a vector
		/// silhouette about 10% deeper than the filtered one beside it — small,
		/// but visible with the two kinds interleaved in one group.
		///
		/// Changing this value must invalidate the cache; see CacheStamp.
		/// </remarks>
		public const string SilhouetteColor = "#191919";

		/// <summary>What a cache directory must be stamped with to be reused.</summary>
		/// <remarks>
		/// A generated file is only as good as the transform that made it, and
		/// the transform is a colour that can change. Without this, retuning the
		/// tint would leave every existing install on the old one forever —
		/// the files are already there, so nothing would regenerate.
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
		public static bool IsVector(string thumbnail)
		{
			if (string.IsNullOrEmpty(thumbnail))
			{
				return false;
			}

			var path = thumbnail.Split('?', '#')[0];

			return path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase);
		}

		/// <summary>
		/// A stable, flat file name for an icon that may live at any depth.
		/// </summary>
		/// <remarks>
		/// The directory is flattened because the host serves one folder, and
		/// the full relative path is kept in the name so two icons called
		/// Placeholder.svg under different roots cannot collide.
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
