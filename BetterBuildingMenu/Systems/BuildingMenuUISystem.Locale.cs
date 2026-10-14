using BetterBuildingMenu.Utilities;
using Game.SceneFlow;

using System;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>Our strings in every language we ship, read once to answer which the active language lacks.</summary>
		private LocaleHelper? _localeStrings;

		/// <summary>The keys of ours the active language has no translation of, so the UI can use the game's words there.</summary>
		private ValueBindingHelper<string[]> _UntranslatedKeys = null!;

		private bool _localeWarned;

		/// <summary>
		/// Publishes which of our strings the active language lacks, now and at each language change.
		/// The game answers those in English, so the UI cannot tell from the string alone.
		/// </summary>
		private void CreateLocaleBindings()
		{
			_UntranslatedKeys = CreateBinding("UntranslatedKeys", Array.Empty<string>());

			try
			{
				_localeStrings = new LocaleHelper("BetterBuildingMenu.Locale.json");
			}
			catch (Exception e)
			{
				// Nothing on the load path throws: without the list the UI keeps our English.
				Mod.Log.Warn(e, "Could not read the mod's strings; the search field keeps its English words");
				return;
			}

			// The handler runs inside the game's language switch, so neither the subscribe nor the
			// handler may throw into it.
			try
			{
				GameManager.instance.localizationManager.onActiveDictionaryChanged += OnLocaleChanged;
			}
			catch (Exception e) { WarnLocaleOnce(e); }

			OnLocaleChanged();
		}

		private void DestroyLocaleBindings()
		{
			if (_localeStrings is not null && GameManager.instance?.localizationManager is { } localization)
			{
				localization.onActiveDictionaryChanged -= OnLocaleChanged;
			}
		}

		private void OnLocaleChanged()
		{
			try
			{
				_UntranslatedKeys.Value = _localeStrings?.UntranslatedKeys(GameManager.instance.localizationManager.activeLocaleId)
					?? Array.Empty<string>();
			}
			catch (Exception e) { WarnLocaleOnce(e); }
		}

		private void WarnLocaleOnce(Exception e)
		{
			if (_localeWarned) { return; }

			_localeWarned = true;
			Mod.Log.Warn($"Could not publish which of the mod's strings the active language lacks: {e.Message}");
		}
	}
}
