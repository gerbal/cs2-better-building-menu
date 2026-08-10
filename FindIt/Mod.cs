using Colossal.Core;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.PSI.Environment;
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

			foreach (var item in new LocaleHelper("FindItBuildingMenu.Locale.json").GetAvailableLanguages())
			{
				GameManager.instance.localizationManager.AddSource(item.LocaleId, item);
			}

			AssetDatabase.global.LoadSettings(nameof(FindItBuildingMenu), Settings, new FindItSettings(this));


			FindItUtil.LoadCustomPrefabData();

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
			updateSystem.UpdateAt<CustomAreaBorderRenderSystem>(SystemUpdatePhase.Rendering);
			updateSystem.UpdateAt<ServiceCoverageOverlaySystem>(SystemUpdatePhase.Rendering);
			updateSystem.UpdateAt<PickerTooltipSystem>(SystemUpdatePhase.UITooltip);
			updateSystem.UpdateAt<AutoVehiclePropGeneratorSystem>(SystemUpdatePhase.MainLoop);
			updateSystem.UpdateAt<AutoQuantityPropGeneratorSystem>(SystemUpdatePhase.MainLoop);

			MainThreadDispatcher.RegisterUpdater(RegisterAPIs);
			MainThreadDispatcher.RegisterUpdater(ClearGooee);
		}

		private void RegisterAPIs()
		{
			foreach (var item in GameManager.instance.modManager)
			{
				if (item.asset.assembly?.GetTypesDerivedFrom<IMod>().FirstOrDefault()?.GetMethod("GetFindItSearchMethod", BindingFlags.Static | BindingFlags.Public) is MethodInfo methodInfo)
				{
					if (methodInfo.GetParameters().Length == 1
						&& methodInfo.GetParameters()[0].ParameterType == typeof(string)
						&& methodInfo.ReturnType == typeof(Func<string, bool>))
					{
						Filters.GetCustomSearchFunction = wrapFunction(methodInfo);

						Log.Info($"Registered search API from {item.name}");
					}
				}
			}

			static Func<string, Func<PrefabIndex, bool>> wrapFunction(MethodInfo method) => searchTerm =>
			{
				var searchMethod = (Func<string, bool>)method.Invoke(null, new object[] { searchTerm });

				return prefab => searchMethod(prefab.Name) || searchMethod(prefab.PrefabName);
			};
		}

		//public static Func<string, bool> GetFindItSearchMethod(string searchText)
		//{
		//	_cachedMatcher?.Dispose();
		//	_cachedMatcher = new IbMatcher.Net.IbMatcher(CurrentSearch, IbMatcherConfig.WithPinyin());

		//	return name => _cachedMatcher.IsMatch(name);
		//}

		public static Dictionary<string, string> GetIconsMap()
		{
			return AutoVehiclePropGeneratorSystem.AssetReferenceMap;
		}

		private void ClearGooee()
		{
			try
			{
				if (!GameManager.instance.modManager.ListModsEnabled().Any(x => x.StartsWith("Gooee,")))
				{
					var folder1 = new DirectoryInfo(Path.Combine(EnvPath.kUserDataPath, "ModsData", "Gooee"));
					var folder2 = new DirectoryInfo(Path.Combine(EnvPath.kUserDataPath, "Mods", "Gooee"));

					if (folder1.Exists)
					{
						folder1.Delete(true);
					}

					if (folder2.Exists)
					{
						folder2.Delete(true);
					}
				}
			}
			catch { }
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
