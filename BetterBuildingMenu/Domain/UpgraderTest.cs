using System.Globalization;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Which sign an earlier release left marked a player as one who ran it.</summary>
	public enum UpgraderSignal
	{
		/// <summary>No sign: a new player.</summary>
		None,

		/// <summary>The settings version 0.2.5 writes.</summary>
		SettingsVersion,

		/// <summary>A release.json a release before the redesign first wrote.</summary>
		Marker,

		/// <summary>A settings key an earlier release wrote.</summary>
		SettingsKey,

		/// <summary>The silhouettes stamp, there before any redesign release ran.</summary>
		Stamp,
	}

	/// <summary>The upgrader test's answer, and the sign that gave it, for OnLoad to log.</summary>
	/// <param name="Signal">The sign that answered, or <see cref="UpgraderSignal.None"/>.</param>
	/// <param name="Detail">Which one: the version, the marker's first release, the key, or which stamp reading.</param>
	public readonly record struct UpgraderDecision(UpgraderSignal Signal, string Detail)
	{
		public bool IsUpgrader => Signal != UpgraderSignal.None;
	}

	/// <summary>Whether this player ran a release from before the redesign, from the signs those releases left.</summary>
	/// <remarks>Pure. See docs/design-notes.md, "Who is an upgrader".</remarks>
	public static class UpgraderTest
	{
		/// <summary>The redesign's first release: a marker it or a later release first wrote is no sign.</summary>
		public const string FirstRedesignRelease = "0.3.0";

		/// <summary>The settings version 0.2.5 writes, the last release before the redesign.</summary>
		public const int InterimVersion = 1;

		/// <summary>
		/// Every key a release from 0.1.0 to 0.2.5 wrote, in the order they are tried. Not the
		/// development builds' ApplyMimic or DefaultAlignmentStyle, which no release declared.
		/// </summary>
		public static readonly IReadOnlyList<string> EarlierReleaseKeys = new[]
		{
			"AssetMenuHeight",
			"AssetMenuCatalogWidth",
			"ControlPaneShown",
			"ReplaceVanillaBuildMenu",
			"AutoWidenSearch",
			"AssetMenuTileSize",
			"BuildingLensPanelHeight",
			"BuildingLensTileSize",
			"ShowCoverageOverlay",
			"SelectPrefabOnOpen",
			"HideRandomAssets",
			"AssetMenuViewMode",
		};

		/// <summary>The first sign that answers, or null once the settings are at the redesign's version or later.</summary>
		/// <param name="storedVersion">The settings version as loaded.</param>
		/// <param name="prior">What ModsData held before this load wrote to it.</param>
		/// <param name="fileKeys">The key names the settings file held.</param>
		/// <param name="firstRedesignRelease">The redesign's first release, <see cref="FirstRedesignRelease"/>.</param>
		/// <remarks>
		/// Asked only below version 2, before this release has saved anything, so a key in the file
		/// is an earlier release's.
		/// </remarks>
		public static UpgraderDecision? Decide(int storedVersion, PriorInstall prior, IReadOnlyCollection<string> fileKeys, string firstRedesignRelease)
		{
			if (storedVersion > InterimVersion)
			{
				return null;
			}

			if (storedVersion == InterimVersion)
			{
				return new UpgraderDecision(UpgraderSignal.SettingsVersion, InterimVersion.ToString(CultureInfo.InvariantCulture));
			}

			if (prior.Marker is { } marker && ReleaseMarker.IsBefore(marker.First, firstRedesignRelease))
			{
				return new UpgraderDecision(UpgraderSignal.Marker, marker.First);
			}

			if (EarlierReleaseKeys.FirstOrDefault(key => fileKeys.Contains(key)) is { } written)
			{
				return new UpgraderDecision(UpgraderSignal.SettingsKey, written);
			}

			// The marker's reading when there is one: every later load finds the stamp its own cache wrote.
			if (prior.Marker?.StampBefore ?? prior.StampExisted)
			{
				return new UpgraderDecision(UpgraderSignal.Stamp, prior.Marker is null ? "stamp" : "stampBefore");
			}

			return new UpgraderDecision(UpgraderSignal.None, string.Empty);
		}
	}
}
