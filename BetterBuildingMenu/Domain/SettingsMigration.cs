using System.Globalization;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What one load's migration did, for OnLoad to save and log.</summary>
	/// <param name="Changed">Whether any value moved, which is when OnLoad saves.</param>
	/// <param name="FromVersion">The settings version as loaded.</param>
	/// <param name="ToVersion">The version now stored.</param>
	/// <param name="Decision">The upgrader test's answer, or null when no step that asks it ran.</param>
	/// <param name="Changes">Each value that moved, as "name old -> new".</param>
	public sealed record SettingsMigrationResult(
		bool Changed,
		int FromVersion,
		int ToVersion,
		UpgraderDecision? Decision,
		IReadOnlyList<string> Changes);

	/// <summary>
	/// Moves a settings file an earlier release wrote to this release's defaults, once: each step
	/// newer than the stored version runs, then this release's version is stored.
	/// </summary>
	/// <remarks>
	/// Pure, over <see cref="ISettingsValues"/>, so tests never build the settings class. Only a
	/// value that was an earlier release's default moves. A per-load sanitiser also brings a
	/// Width step outside its range to the first, but only in a file at this version or earlier:
	/// a later release's file is left whole. See docs/design-notes.md, "The settings
	/// migration".
	/// </remarks>
	public static class SettingsMigration
	{
		/// <summary>This release's settings version: 1 is 0.2.5's, 2 the Width steps'.</summary>
		public const int Current = 2;

		/// <summary>The heights earlier releases shipped as their default: 420, from 0.2.3 to 0.2.5, and an unreleased build's 155.</summary>
		public static readonly IReadOnlyList<float> EarlierDefaultHeights = new[] { 420f, 155f };

		/// <summary>How near an earlier default a stored height must be to count as it: the height commit's own tolerance.</summary>
		public const float HeightTolerance = 0.1f;

		/// <summary>Runs every step newer than the stored version, then, for a file at this version or earlier, keeps the Width step within its range.</summary>
		/// <param name="values">The settings as loaded, changed in place.</param>
		/// <param name="fileKeys">The key names the settings file held.</param>
		/// <param name="prior">What ModsData held before this load wrote to it.</param>
		/// <param name="aspect">The screen's aspect, which sizes the Width steps.</param>
		public static SettingsMigrationResult Migrate(ISettingsValues values, IReadOnlyCollection<string> fileKeys, PriorInstall prior, double aspect)
		{
			var from = values.SettingsVersion;
			var changes = new List<string>();
			UpgraderDecision? decision = null;

			if (from < Current)
			{
				var asked = UpgraderTest.Decide(from, prior, fileKeys, UpgraderTest.FirstRedesignRelease)
					?? new UpgraderDecision(UpgraderSignal.None, string.Empty);
				decision = asked;
				ToWidthSteps(values, asked.IsUpgrader, aspect, changes);
			}

			// On every load at this version or earlier: a hand edit or a bad write can leave a step
			// the UI has no width for. A later release's file is left alone, its steps included.
			if (from <= Current)
			{
				Set(nameof(ISettingsValues.AssetMenuWidthStep), values.AssetMenuWidthStep, WidthSteps.Sanitize(values.AssetMenuWidthStep), value => values.AssetMenuWidthStep = value, changes);
			}

			if (from < Current)
			{
				Set(nameof(ISettingsValues.SettingsVersion), values.SettingsVersion, Current, value => values.SettingsVersion = value, changes);
			}

			return new SettingsMigrationResult(changes.Count > 0, from, values.SettingsVersion, decision, changes);
		}

		/// <summary>One line for the log: what the load found, the sign that decided, and what moved.</summary>
		public static string Describe(IReadOnlyCollection<string> fileKeys, PriorInstall prior, SettingsMigrationResult result)
		{
			var keys = fileKeys.Count == 0 ? "none" : string.Join(",", fileKeys.OrderBy(key => key, StringComparer.Ordinal));
			var marker = prior.Marker is { } found
				? string.Format(CultureInfo.InvariantCulture, "first={0} stampBefore={1}", found.First, found.StampBefore)
				: "none";
			var upgrader = result.Decision is { } decision
				? (decision.Detail.Length > 0 ? $"{decision.Signal}({decision.Detail})" : decision.Signal.ToString())
				: "not asked";
			var changed = result.Changes.Count == 0 ? "nothing" : string.Join("; ", result.Changes);

			return string.Format(
				CultureInfo.InvariantCulture,
				"version {0} -> {1}; keys {2}; marker {3}; stamp {4}; upgrader {5}; changed {6}",
				result.FromVersion,
				result.ToVersion,
				keys,
				marker,
				prior.StampExisted,
				upgrader,
				changed);
		}

		/// <summary>Version 2: the upgrader flag, the catalog's height, and the width as a Width step.</summary>
		private static void ToWidthSteps(ISettingsValues values, bool upgrader, double aspect, List<string> changes)
		{
			if (upgrader)
			{
				Set(nameof(ISettingsValues.Upgrader), values.Upgrader, true, value => values.Upgrader = value, changes);
			}

			if (EarlierDefaultHeights.Any(height => Math.Abs(values.AssetMenuHeight - height) < HeightTolerance))
			{
				Set(nameof(ISettingsValues.AssetMenuHeight), values.AssetMenuHeight, AssetMenuHeight.Default, value => values.AssetMenuHeight = value, changes);
			}

			var step = upgrader ? WidthSteps.Nearest(WidthTheyHad(values.AssetMenuCatalogWidth), aspect) : WidthSteps.DefaultStep;
			Set(nameof(ISettingsValues.AssetMenuWidthStep), values.AssetMenuWidthStep, step, value => values.AssetMenuWidthStep = value, changes);
		}

		/// <summary>The width a 0.2.4 player had: the width they dragged to, or for the default, the room beside the pane.</summary>
		private static double WidthTheyHad(float stored) =>
			float.IsNaN(stored) || float.IsInfinity(stored) || stored <= AssetMenuCatalogWidth.Default
				? AssetMenuCatalogWidth.UpgraderWidth
				: stored;

		private static void Set<T>(string name, T current, T next, Action<T> write, List<string> changes)
		{
			if (EqualityComparer<T>.Default.Equals(current, next))
			{
				return;
			}

			write(next);
			changes.Add(string.Format(CultureInfo.InvariantCulture, "{0} {1} -> {2}", name, current, next));
		}
	}
}
