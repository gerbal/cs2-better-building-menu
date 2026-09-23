using Colossal.Core;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Reflection;
using Colossal.UI;

using BetterBuildingMenu.Domain;
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

		public static ILog Log { get; } = LogManager.GetLogger(nameof(BetterBuildingMenu)).SetShowsErrorsInUI(false);
		public static BetterBuildingMenuSettings Settings { get; private set; }

		/// <summary>Whether Extra Detailing Tools is enabled, as of the last full index pass.</summary>
		public static bool IsExtraDetailingEnabled { get; private set; }

		/// <summary>Whether Road Builder is enabled, as of the last full index pass.</summary>
		public static bool IsRoadBuilderEnabled { get; private set; }

		/// <summary>Re-reads which of the mods we adapt to are enabled.</summary>
		/// <remarks>Per full pass, not once per process: the game re-reads the playset at every city
		/// load, so a mod can join without a restart. See docs/indexing.md, "Load timing".</remarks>
		internal static void RefreshEnabledMods()
		{
			var enabled = GameManager.instance.modManager.ListModsEnabled();

			IsExtraDetailingEnabled = EnabledMods.Contains(enabled, "ExtraDetailingTools");
			IsRoadBuilderEnabled = EnabledMods.Contains(enabled, "RoadBuilder");
		}

		/// <summary>Black copies of the game's vector icons, for locked tiles.</summary>
		public static SilhouetteIconCache Silhouettes { get; private set; }

		private static string SilhouetteFolder =>
			Path.Combine(FolderUtil.ContentFolder, "silhouettes");

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

		// What OnLoad hands the game, so OnDispose can take it back.
		private readonly List<LocaleHelper.DictionarySource> _localeSources = new();

		public void OnLoad(UpdateSystem updateSystem)
		{
			Log.Info(nameof(OnLoad));

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
				_localeSources.Add(item);
			}

			AssetDatabase.global.LoadSettings(nameof(BetterBuildingMenu), Settings, new BetterBuildingMenuSettings(this));

			updateSystem.UpdateAfter<PrefabIndexingSystem>(SystemUpdatePhase.PrefabUpdate);
			// Twice, because PrefabUpdate is not a frame phase: PrefabSystem
			// drives it only when prefabs change, and an unlock flips Locked
			// without touching one. UIUpdate ticks every frame.
			updateSystem.UpdateAt<PrefabIndexingSystem>(SystemUpdatePhase.UIUpdate);
			updateSystem.UpdateAt<BuildingMenuUISystem>(SystemUpdatePhase.UIUpdate);

		}

		public void OnDispose()
		{
			Log.Info(nameof(OnDispose));

			if (Settings != null)
			{
				Settings.UnregisterInOptionsUI();
				Settings = null;
			}

			// The game may be tearing its own managers down by now.
			var localization = GameManager.instance?.localizationManager;

			foreach (var item in _localeSources)
			{
				localization?.RemoveSource(item.LocaleId, item);
			}

			_localeSources.Clear();

			UIManager.defaultUISystem?.RemoveHostLocation(ImagesHost);
			UIManager.defaultUISystem?.RemoveHostLocation(SilhouetteIcons.HostName);
		}
	}
}
