namespace BetterBuildingMenu.Domain
{
	/// <summary>What ModsData held when the mod began to load, before this load wrote anything there.</summary>
	/// <param name="Marker">release.json as an earlier load left it, or null when there is none this release reads.</param>
	/// <param name="StampExisted">Whether the silhouettes stamp existed, before this load's cache writes its own.</param>
	/// <remarks>See docs/design-notes.md, "Who is an upgrader".</remarks>
	public readonly record struct PriorInstall(ReleaseMarkerData? Marker, bool StampExisted)
	{
		/// <summary>Nothing there: a computer the mod has not loaded on, or a folder that cannot be read.</summary>
		public static PriorInstall Nothing => default;

		/// <summary>The marker as read, or none for a file that is absent, corrupt or in a newer format.</summary>
		public static PriorInstall From(ReleaseMarkerRead marker, bool stampExisted) =>
			new(marker.State == ReleaseMarkerState.Read ? marker.Data : null, stampExisted);
	}
}
