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
	/// value that was an earlier release's default moves, and a new player's control pane goes off.
	/// A per-load sanitiser also brings a Width step outside its range to the first, but only in a
	/// file at this version or earlier: a later release's file is left whole. See
	/// docs/design-notes.md, "The settings migration".
	/// </remarks>
	public static class SettingsMigration
	{
		/// <summary>This release's settings version: 1 is 0.2.5's, 2 the Width steps', 3 the top row's.</summary>
		public const int Current = 3;

		/// <summary>The version that introduced the Width steps, and the one question the upgrader test is asked for.</summary>
		internal const int WidthStepsVersion = 2;

		/// <summary>The version that gave the box its top row: a shorter default body, and the control pane an upgrader's choice.</summary>
		internal const int ControlPaneVersion = 3;

		/// <summary>The heights earlier releases shipped as their default: 420, from 0.2.3 to 0.2.5, and an unreleased build's 155.</summary>
		public static readonly IReadOnlyList<float> EarlierDefaultHeights = new[] { 420f, 155f };

		/// <summary>
		/// The height version 2 moves an earlier default to, and version 3 moves on: the game's own
		/// 208 under the 14 rem strip and the 45 rem header the box had then.
		/// </summary>
		public const float WidthStepsHeight = 149f;

		/// <summary>How near an earlier default a stored height must be to count as it: the height commit's own tolerance.</summary>
		public const float HeightTolerance = 0.1f;

		/// <summary>Runs every step newer than the stored version, then, for a file at this version or earlier, keeps the Width step within its range.</summary>
		/// <param name="values">The settings as loaded, changed in place.</param>
		/// <param name="fileKeys">The key names the settings file held.</param>
		/// <param name="prior">What ModsData held before this load wrote to it.</param>
		/// <param name="aspect">The screen's aspect, which sizes the Width steps.</param>
		public static SettingsMigrationResult Migrate(ISettingsValues values, IReadOnlyCollection<string> fileKeys, PriorInstall prior, double aspect) =>
			Migrate(values, fileKeys, prior, aspect, Current);

		/// <summary>Migrates to a given version, so a test can run one step alone or the steps a later release will add.</summary>
		internal static SettingsMigrationResult Migrate(ISettingsValues values, IReadOnlyCollection<string> fileKeys, PriorInstall prior, double aspect, int target)
		{
			var from = values.SettingsVersion;
			var changes = new List<string>();
			UpgraderDecision? decision = null;

			if (from < WidthStepsVersion && WidthStepsVersion <= target)
			{
				// Below version 2 the test always answers, so the default is never read.
				var asked = UpgraderTest.Decide(from, prior, fileKeys, UpgraderTest.FirstRedesignRelease).GetValueOrDefault();
				decision = asked;
				ToWidthSteps(values, asked.IsUpgrader, aspect, changes);
			}

			// Reads the flag version 2 stored, in this run or an earlier one.
			if (from < ControlPaneVersion && ControlPaneVersion <= target)
			{
				ToTopRow(values, changes);
			}

			// On every load at this version or earlier: a hand edit or a bad write can leave a step
			// the UI has no width for. A later release's file is left alone, its steps included.
			if (from <= target)
			{
				Set(nameof(ISettingsValues.AssetMenuWidthStep), values.AssetMenuWidthStep, WidthSteps.Sanitize(values.AssetMenuWidthStep), value => values.AssetMenuWidthStep = value, changes);
			}

			if (from < target)
			{
				Set(nameof(ISettingsValues.SettingsVersion), values.SettingsVersion, target, value => values.SettingsVersion = value, changes);
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
				Set(nameof(ISettingsValues.AssetMenuHeight), values.AssetMenuHeight, WidthStepsHeight, value => values.AssetMenuHeight = value, changes);
			}

			var step = upgrader ? WidthSteps.Nearest(WidthTheyHad(values.AssetMenuCatalogWidth), aspect) : WidthSteps.DefaultStep;
			Set(nameof(ISettingsValues.AssetMenuWidthStep), values.AssetMenuWidthStep, step, value => values.AssetMenuWidthStep = value, changes);
		}

		/// <summary>
		/// Version 3, the top row: version 2's height becomes the body under the new chrome, any other
		/// height is kept, at least the floor; the control pane stays an upgrader's as loaded, and goes
		/// off for everyone else.
		/// </summary>
		private static void ToTopRow(ISettingsValues values, List<string> changes)
		{
			var height = Math.Abs(values.AssetMenuHeight - WidthStepsHeight) < HeightTolerance
				? AssetMenuHeight.Default
				: AssetMenuHeight.Clamp(values.AssetMenuHeight);
			Set(nameof(ISettingsValues.AssetMenuHeight), values.AssetMenuHeight, height, value => values.AssetMenuHeight = value, changes);

			// An upgrader's file without the key loads shown, as 0.2.4 read it, and stays so.
			if (!values.Upgrader)
			{
				Set(nameof(ISettingsValues.ControlPaneShown), values.ControlPaneShown, false, value => values.ControlPaneShown = value, changes);
			}
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
