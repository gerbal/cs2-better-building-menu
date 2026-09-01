using Colossal.Core;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Reflection;
using Colossal.UI;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

using Game;
using Game.Modding;
using Game.SceneFlow;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

using Unity.Entities;

namespace FindItBuildingMenu
{
	public class Mod : IMod
	{
		public const string Id = "FindItBuildingMenu";
		private static bool? isExtraDetailingEnabled;
		private static bool? isAssetIconLibraryEnabled;
		private static bool? isRoadBuilderEnabled;

		public static ILog Log { get; } = LogManager.GetLogger(nameof(FindItBuildingMenu)).SetShowsErrorsInUI(false);
		public static FindItSettings Settings { get; private set; }

		public static bool IsExtraDetailingEnabled => isExtraDetailingEnabled ??= GameManager.instance.modManager.ListModsEnabled().Any(x => x.StartsWith("ExtraDetailingTools, "));
		public static bool IsAssetIconLibraryEnabled => isAssetIconLibraryEnabled ??= GameManager.instance.modManager.ListModsEnabled().Any(x => x.StartsWith("AssetIconLibrary, "));
		public static bool IsRoadBuilderEnabled => isRoadBuilderEnabled ??= GameManager.instance.modManager.ListModsEnabled().Any(x => x.StartsWith("RoadBuilder, "));

		/// <summary>Black copies of the game's vector icons, for locked tiles.</summary>
		public static SilhouetteIconCache Silhouettes { get; private set; }

		private static string SilhouetteFolder =>
			Path.Combine(FolderUtil.ContentFolder, "silhouettes");

		/// <summary>
		/// Every UI content root the game serves icons from.
		/// </summary>
		/// <remarks>
		/// A thumbnail URL is relative to the UI root ("Media/Game/Icons/X.svg"),
		/// and each of the base game, every DLC and every content pack ships its
		/// own root under Content/. Searching all of them is what lets a DLC
		/// icon be blackened as readily as a base-game one.
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

		public void OnLoad(UpdateSystem updateSystem)
		{
			Log.Info(nameof(OnLoad));

			Settings = new FindItSettings(this);
			Settings.RegisterInOptionsUI();
			Settings.RegisterKeyBindings();

			if (GameManager.instance.modManager.TryGetExecutableAsset(this, out var asset))
			{
				UIManager.defaultUISystem.AddHostLocation($"finditbuildingmenu", Path.Combine(Path.GetDirectoryName(asset.path), "images"), false);
			}

			// A SECOND host, deliberately not the one above. Blackened copies of
			// the game's vector icons are written at runtime (see
			// SilhouetteIcons for why they have to exist at all), and writing
			// into the deployed mod folder makes the mod file watcher reload the
			// UI — which killed the running game twice during that
			// investigation. ModsData is ours and unwatched.
			Silhouettes = new SilhouetteIconCache(ContentRoots(), SilhouetteFolder);
			UIManager.defaultUISystem.AddHostLocation(SilhouetteIcons.HostName, SilhouetteFolder, false);

			foreach (var item in new LocaleHelper("FindItBuildingMenu.Locale.json").GetAvailableLanguages())
			{
				GameManager.instance.localizationManager.AddSource(item.LocaleId, item);
			}

			AssetDatabase.global.LoadSettings(nameof(FindItBuildingMenu), Settings, new FindItSettings(this));



			updateSystem.UpdateAfter<PrefabIndexingSystem>(SystemUpdatePhase.PrefabUpdate);
			// Twice, because PrefabUpdate is not a frame phase. Nothing in the
			// player loop drives it: PrefabSystem calls Update(PrefabUpdate)
			// itself, only when prefabs have changed. That is right for the
			// incremental index, and useless for watching unlocks — a milestone
			// or a tech-tree node flips Locked and raises an Unlock event without
			// touching a prefab, so the phase never fires and the index kept the
			// lock state it was born with until the save was reloaded.
			//
			// UIUpdate is the phase that ticks. UIUpdateSystem sits in MainLoop
			// after UnlockSystem and drives it every frame, which is exactly how
			// vanilla's ToolbarUISystem sees the same events. CS2's UpdateSystem
			// keeps a flat list of (phase, system) rather than Unity's system
			// groups, so a system may appear in two phases; both entries call the
			// same guarded OnUpdate.
			updateSystem.UpdateAt<PrefabIndexingSystem>(SystemUpdatePhase.UIUpdate);
			updateSystem.UpdateAt<FindItUISystem>(SystemUpdatePhase.UIUpdate);
			updateSystem.UpdateAt<OptionsUISystem>(SystemUpdatePhase.UIUpdate);
			updateSystem.UpdateAt<PickerToolSystem>(SystemUpdatePhase.ToolUpdate);
			updateSystem.UpdateAt<PickerUISystem>(SystemUpdatePhase.UIUpdate);
			updateSystem.UpdateAt<PrefabTrackingSystem>(SystemUpdatePhase.PrefabUpdate);
			updateSystem.UpdateAt<ServiceCoverageOverlaySystem>(SystemUpdatePhase.Rendering);
			updateSystem.UpdateAt<PickerTooltipSystem>(SystemUpdatePhase.UITooltip);

		}

		public void OnDispose()
		{
			Log.Info(nameof(OnDispose));

			if (Settings != null)
			{
				Settings.UnregisterInOptionsUI();
				Settings = null;
			}
		}
	}
}
