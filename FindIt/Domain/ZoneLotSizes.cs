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
	public readonly record struct ZoneLotSizes(
		int MinWidth,
		int MaxWidth,
		int MinDepth,
		int MaxDepth)
	{
		public static ZoneLotSizes From(int width, int depth) => new(width, width, depth, depth);

		public ZoneLotSizes Include(int width, int depth) => new(
			MinWidth < width ? MinWidth : width,
			MaxWidth > width ? MaxWidth : width,
			MinDepth < depth ? MinDepth : depth,
			MaxDepth > depth ? MaxDepth : depth);

		/// <summary>True when every building here is the same footprint.</summary>
		public bool IsSingleSize => MinWidth == MaxWidth && MinDepth == MaxDepth;
	}
}
