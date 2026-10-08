using Colossal.Core;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Reflection;
using Colossal.UI;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Systems;
using BetterBuildingMenu.Utilities;

using Game;
using Game.Modding;
using Game.SceneFlow;

using System.IO;

using Unity.Entities;

namespace BetterBuildingMenu
{
	public class Mod : IMod
	{
		public const string Id = "BetterBuildingMenu";

		// A release logs two Info lines a load (OnLoad and the full pass's summary) plus
		// warnings and errors; every diagnostic is at Debug. A development build turns
		// Debug on, so the audits and per-refresh timings are there while developing.
		public static ILog Log { get; } = LogManager.GetLogger(nameof(BetterBuildingMenu))
			.SetShowsErrorsInUI(false)
#if DEBUG
			.SetEffectiveness(Level.Debug)
#endif
			;
		// Set in OnLoad and cleared in OnDispose, so null outside them, a test run included.
		// Everything that reads it runs in between, except BuildingMenuUISystem.OnDestroy,
		// which checks.
		public static BetterBuildingMenuSettings Settings { get; private set; } = null!;

		/// <summary>Reads which of the mods we adapt to are enabled.</summary>
		/// <remarks>Per full pass, not once per process: the game re-reads the playset at every city
		/// load, so a mod can join without a restart. See docs/indexing.md, "Load timing".</remarks>
		internal static ModCompatibility ReadEnabledMods()
		{
			var enabled = GameManager.instance.modManager.ListModsEnabled();

			return new ModCompatibility(
				ExtraDetailing: EnabledMods.Contains(enabled, "ExtraDetailingTools"),
				RoadBuilder: EnabledMods.Contains(enabled, "RoadBuilder"));
		}

		/// <summary>Black copies of the game's vector icons, for locked tiles.</summary>
		/// <remarks>Null until OnLoad, which a test run never calls.</remarks>
		public static SilhouetteIconCache? Silhouettes { get; private set; }

		private static string SilhouetteFolder =>
			Path.Combine(FolderUtil.ContentFolder, SilhouetteIconCache.FolderName);

		/// <summary>Every UI content root the game serves icons from.</summary>
		/// <remarks>
		/// A thumbnail URL is relative to the UI root, and the base game, each
		/// DLC and each content pack ships its own root under Content/, so a DLC
		/// icon is only found by searching all of them.
		/// </remarks>
		private static IReadOnlyList<string> ContentRoots()
		{
			var content = Path.Combine(UnityEngine.Application.dataPath, "Content");

			if (!Directory.Exists(content))
			{
				return System.Array.Empty<string>();
			}

			return Directory.GetDirectories(content)
				.Select(directory => Path.Combine(directory, "UI"))
				.Where(Directory.Exists)
				.ToArray();
		}

		private const string ImagesHost = "betterbuildingmenu";

		public void OnLoad(UpdateSystem updateSystem)
		{
			Log.Info(nameof(OnLoad));

			// First: the silhouette cache below writes the stamp the marker reads.
			WriteReleaseMarker();

			Settings = new BetterBuildingMenuSettings(this);
			Settings.RegisterInOptionsUI();

			if (GameManager.instance.modManager.TryGetExecutableAsset(this, out var asset))
			{
				UIManager.defaultUISystem.AddHostLocation(ImagesHost, Path.Combine(Path.GetDirectoryName(asset.path), "images"), false);
			}

			// A SECOND host, deliberately not the one above: blackened icon
			// copies are written at runtime, and writing into the deployed mod
			// folder makes the mod file watcher reload the UI. ModsData is ours.
			Silhouettes = new SilhouetteIconCache(ContentRoots(), SilhouetteFolder);
			UIManager.defaultUISystem.AddHostLocation(SilhouetteIcons.HostName, SilhouetteFolder, false);

			foreach (var item in new LocaleHelper("BetterBuildingMenu.Locale.json").GetAvailableLanguages())
			{
				GameManager.instance.localizationManager.AddSource(item.LocaleId, item);
			}

			AssetDatabase.global.LoadSettings(nameof(BetterBuildingMenu), Settings, new BetterBuildingMenuSettings(this));
			StepSettingsVersion();

			// UIUpdate follows PrefabSystem and UnlockSystem in the same frame, and the
			// indexer is registered before the asset menu, which reads it. See
			// docs/indexing.md, "Partial passes".
			updateSystem.UpdateAt<PrefabIndexingSystem>(SystemUpdatePhase.UIUpdate);
			updateSystem.UpdateAt<BuildingMenuUISystem>(SystemUpdatePhase.UIUpdate);

		}

		/// <summary>Moves release.json to this release. Never throws.</summary>
		/// <remarks>
		/// FolderUtil is first touched inside the guard: its static constructor creates the folder
		/// and can fail. See docs/design-notes.md, "The release marker and the settings version".
		/// </remarks>
		private static void WriteReleaseMarker()
		{
			try
			{
				ReleaseMarkerFile.Update(
					FolderUtil.ContentFolder,
					ReleaseMarker.ReleaseOf(typeof(Mod).Assembly.GetName().Version),
					message => Log.Warn(message));
			}
			catch (Exception ex)
			{
				Log.Warn(ex, "Could not update the release marker");
			}
		}

		/// <summary>Raises the stored settings version to this release's, saving once if it moved.</summary>
		/// <remarks>Before the systems are created, so nothing is subscribed to the apply yet.</remarks>
		private static void StepSettingsVersion()
		{
			try
			{
				var next = SettingsVersionStep.Next(Settings.SettingsVersion);

				if (next == Settings.SettingsVersion)
				{
					return;
				}

				Settings.SettingsVersion = next;
				Settings.ApplyAndSave();
			}
			catch (Exception ex)
			{
				Log.Warn(ex, "Could not save the settings version");
			}
		}

		public void OnDispose()
		{
			Log.Debug(nameof(OnDispose));

			// Never throws. The game also calls this from the catch around a failed
			// OnLoad, and an exception from here escapes that catch and stops every
			// mod after this one from initializing.
			try
			{
				// Null when OnLoad failed before setting it.
				if (Settings != null)
				{
					Settings.UnregisterInOptionsUI();
					Settings = null!;
				}

				// The locale sources stay registered: removing one makes the game reload
				// the active dictionary, which at quit is work for nothing.
				UIManager.defaultUISystem?.RemoveHostLocation(ImagesHost);
				UIManager.defaultUISystem?.RemoveHostLocation(SilhouetteIcons.HostName);
			}
			catch (Exception ex)
			{
				Log.Error(ex, "OnDispose failed");
			}
		}
	}
}
