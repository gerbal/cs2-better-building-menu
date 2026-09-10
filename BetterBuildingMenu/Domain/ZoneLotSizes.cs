using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The range of lot sizes a zone's spawnable buildings occupy.
	/// </summary>
	/// <remarks>
	/// The game knows this and never says it. A zone whose buildings are all 2x2
	/// fills a two-cell strip and nothing wider, which decides how a block should be
	/// drawn — and the density tier does not imply it.
	/// </remarks>
	public sealed class ZoneLotSizes
	{
		/// <summary>
		/// Beyond this many widths the glyph strip stops being scannable.
		/// Whatever is dropped is counted, never silently discarded.
		/// </summary>
		public const int MaxFootprintsShown = 12;

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
		/// One shape per distinct width, narrowest first.
		/// </summary>
		/// <remarks>
		/// Every width crossed with every depth is combinatorial noise, so the strip
		/// collapses to one glyph per width and shows the shallowest real shape at that
		/// width. Sorted here because the order is a property of the answer, not the drawing.
		/// </remarks>
		public ZoneFootprint[] Footprints => _footprints
			.GroupBy(size => size.Width)
			.OrderBy(group => group.Key)
			.Select(group => new ZoneFootprint(group.Key, group.Min(size => size.Depth)))
			.Take(MaxFootprintsShown)
			.ToArray();

		/// <summary>How many widths were left out of that list.</summary>
		public int FootprintOverflow
		{
			get
			{
				int widths = _footprints.Select(size => size.Width).Distinct().Count();

				return widths > MaxFootprintsShown ? widths - MaxFootprintsShown : 0;
			}
		}

		/// <summary>True when every building here is the same footprint.</summary>
		public bool IsSingleSize => MinWidth == MaxWidth && MinDepth == MaxDepth;
	}
}
