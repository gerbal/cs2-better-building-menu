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

        public static string Translate(string id, string? fallback = null)
        {
            if (GameManager.instance.localizationManager.activeDictionary.TryGetValue(id, out var result)
                && WordFormat.GameText(result) is { } text)
            {
                return text;
            }

            return fallback ?? id;
        }

        /// <summary>
        /// One source per language, each translation with English under its Options keys,
        /// the ones the game's Options screen reads with no fallback. See <see cref="LocaleFallback"/>.
        /// </summary>
        public IEnumerable<DictionarySource> GetAvailableLanguages()
        {
            var english = _locale[string.Empty];

            foreach (var item in _locale)
            {
                yield return item.Key is ""
                    ? new DictionarySource("en-US", english)
                    : new DictionarySource(item.Key, LocaleFallback.Merge(english, item.Value));
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
