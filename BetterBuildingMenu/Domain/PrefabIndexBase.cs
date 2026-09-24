using Game.Prefabs;

namespace BetterBuildingMenu.Domain
{
	public class PrefabIndexBase
	{
		public PrefabBase Prefab { get; }
		public int Id { get; set; }
		public string PrefabName { get; set; } = string.Empty;
		/// <summary>The game's name for the prefab, before <see cref="DuplicateNameNumbering"/>
		/// numbers it apart from its namesakes into <see cref="Name"/>.</summary>
		public string AssetName { get; set; } = string.Empty;
		public string Name { get; set; } = string.Empty;
		public string? PdxModsId { get; set; }
		public string? Thumbnail { get; set; }
		public string? FallbackThumbnail { get; set; }
		public string? CategoryThumbnail { get; set; }
		public bool IsRandom { get; set; }

		public PrefabIndexBase(PrefabBase prefabBase)
		{
			Prefab = prefabBase;
		}
	}
}
