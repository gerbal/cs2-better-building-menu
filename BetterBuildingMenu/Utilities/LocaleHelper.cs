using Colossal;
using Colossal.Json;
using Game.SceneFlow;

using System.Collections.Generic;
using System.IO;
using System.Text;

using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Utilities
{
    public class LocaleHelper
    {
        private readonly Dictionary<string, Dictionary<string, string>> _locale;

        public LocaleHelper(Dictionary<string, string> dictionary)
        {
			_locale = new Dictionary<string, Dictionary<string, string>>
			{
				[string.Empty] = dictionary
			};
		}

        public LocaleHelper(string dictionaryResourceName)
        {
            var assembly = GetType().Assembly;

            _locale = new Dictionary<string, Dictionary<string, string>>
            {
                [string.Empty] = GetDictionary(dictionaryResourceName)
            };

            foreach (var name in assembly.GetManifestResourceNames())
            {
                if (name == dictionaryResourceName || !name.Contains(Path.GetFileNameWithoutExtension(dictionaryResourceName) + "."))
                {
                    continue;
                }

                var key = Path.GetFileNameWithoutExtension(name);

                _locale[key.Substring(key.LastIndexOf('.') + 1)] = GetDictionary(name);
            }

            Dictionary<string, string> GetDictionary(string resourceName)
            {
                using var resourceStream = assembly.GetManifestResourceStream(resourceName);
                if (resourceStream == null)
                {
                    return new Dictionary<string, string>();
                }

                using var reader = new StreamReader(resourceStream, Encoding.UTF8);
                JSON.MakeInto<Dictionary<string, string>>(JSON.Load(reader.ReadToEnd()), out var dictionary);

                return dictionary;
            }
        }

        public static string Translate(string id, string fallback = null)
        {
            if (GameManager.instance.localizationManager.activeDictionary.TryGetValue(id, out var result))
            {
                return result;
            }

            return fallback ?? id;
        }

        /// <summary>
        /// A label for one of our identifiers, preferring the game's own string.
        /// </summary>
        /// <remarks>
        /// Category and subcategory labels name the game's own concepts, and it
        /// ships those in every language it supports while the mod's
        /// Locale.json is English only. Asking the game first localizes the
        /// panel's chrome for free; a missing key falls through to the mod's
        /// string, so nothing regresses.
        /// </remarks>
        public static string TranslateLabel(string identifier, string fallback)
        {
            string gameKey = GameLocaleKeys.For(identifier);
            if (gameKey != null)
            {
                string localized = Translate(gameKey, string.Empty);
                if (!string.IsNullOrWhiteSpace(localized))
                {
                    return localized;
                }
            }

            return Translate($"Tooltip.LABEL[{Mod.Id}.{identifier}]", fallback);
        }

        /// <summary>A tooltip string for one of our short identifiers.</summary>
        /// <remarks>
        /// The fallback is required, not optional. Each locale is registered as
        /// its OWN DictionarySource (see GetAvailableLanguages) with no merge
        /// against the English one, so a key present in Locale.json but absent
        /// from the active locale is simply not in activeDictionary — and
        /// Translate answers a miss with the id itself. Every other call site
        /// passes English and degrades to it; this one did not, and the picker's
        /// five filter chips rendered as the literal text
        /// "Tooltip.LABEL[BetterBuildingMenu.PickerBuildings]" in all thirteen
        /// translated languages. Making the parameter required is what stops a
        /// later caller from reopening that.
        /// </remarks>
        internal static string GetTooltip(string key, string fallback)
        {
            return Translate($"Tooltip.LABEL[{Mod.Id}.{key}]", fallback);
        }

        public IEnumerable<DictionarySource> GetAvailableLanguages()
        {
            foreach (var item in _locale)
            {
                yield return new DictionarySource(item.Key is "" ? "en-US" : item.Key, item.Value);
            }
        }

        public class DictionarySource : IDictionarySource
        {
            private readonly Dictionary<string, string> _dictionary;

            public DictionarySource(string localeId, Dictionary<string, string> dictionary)
            {
                LocaleId = localeId;
                _dictionary = dictionary;
            }

            public string LocaleId { get; }

            public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
            {
                return _dictionary;
            }

            public void Unload() { }
        }
    }
}
