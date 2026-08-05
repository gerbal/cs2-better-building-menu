using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The range of lot sizes a zone's spawnable buildings occupy.
	/// </summary>
	/// <remarks>
	/// The game knows this and never says it. A zone whose buildings are all
	/// 2x2 fills a two-cell strip and nothing wider, which decides how a block
	/// should be drawn — and the density tier does not imply it: a low-density
	/// zone and a row-housing zone can both be narrow for different reasons.
	///
	/// Accumulated in one pass over the spawnable buildings, which also replaced
	/// the per-zone rescan the row-housing test used to do.
	/// </remarks>
	public sealed class ZoneLotSizes
	{
		/// <summary>
		/// Beyond this many distinct shapes the glyph strip stops being
		/// scannable and starts being a texture. Whatever is dropped is counted,
		/// never silently discarded.
		/// </summary>
		public const int MaxFootprintsShown = 8;

		private readonly HashSet<(int Width, int Depth)> _footprints = new();

		public int MinWidth { get; private set; }
		public int MaxWidth { get; private set; }
		public int MinDepth { get; private set; }
		public int MaxDepth { get; private set; }

		public static ZoneLotSizes From(int width, int depth)
		{
			var sizes = new ZoneLotSizes
			{
				MinWidth = width,
				MaxWidth = width,
				MinDepth = depth,
				MaxDepth = depth,
			};
			sizes._footprints.Add((width, depth));

			return sizes;
		}

		public ZoneLotSizes Include(int width, int depth)
		{
			MinWidth = MinWidth < width ? MinWidth : width;
			MaxWidth = MaxWidth > width ? MaxWidth : width;
			MinDepth = MinDepth < depth ? MinDepth : depth;
			MaxDepth = MaxDepth > depth ? MaxDepth : depth;
			_footprints.Add((width, depth));

			return this;
		}

		/// <summary>
		/// The distinct shapes, narrowest first, then shallowest.
		/// </summary>
		/// <remarks>
		/// Sorted here rather than in the UI because the order is a property of
		/// the answer, not of how it is drawn: narrow to wide is how a player
		/// scans for the one that fits the gap they have.
		/// </remarks>
		public ZoneFootprint[] Footprints => _footprints
			.OrderBy(size => size.Width)
			.ThenBy(size => size.Depth)
			.Take(MaxFootprintsShown)
			.Select(size => new ZoneFootprint(size.Width, size.Depth))
			.ToArray();

		/// <summary>How many distinct shapes were left out of that list.</summary>
		public int FootprintOverflow => _footprints.Count > MaxFootprintsShown
			? _footprints.Count - MaxFootprintsShown
			: 0;

		/// <summary>True when every building here is the same footprint.</summary>
		public bool IsSingleSize => MinWidth == MaxWidth && MinDepth == MaxDepth;
	}
}
