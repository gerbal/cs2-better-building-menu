namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// When the asset menu owes a republish because the index moved under it.
	/// </summary>
	/// <remarks>
	/// The indexer bumps a generation and knows nothing of the asset menu; the asset menu polls it from
	/// OnUpdate. A publish records the generation it read, so only a change after it asks again,
	/// and a closed asset menu asks nothing: opening it publishes anyway.
	/// </remarks>
	public sealed class IndexWatch
	{
		private int _seen;

		/// <summary>Records the generation a publish read.</summary>
		public void Published(int generation) => _seen = generation;

		/// <summary>Whether to schedule a republish: once per change, and only while open.</summary>
		public bool ShouldRefresh(bool panelOpen, int generation)
		{
			if (!panelOpen || generation == _seen)
			{
				return false;
			}

			_seen = generation;
			return true;
		}
	}
}
