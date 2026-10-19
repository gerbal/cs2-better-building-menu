using BetterBuildingMenu.Utilities;

using Colossal.Serialization.Entities;

using Game;

using System.Linq;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Projects every menu while the load screen is still up, so no menu's first open
		/// pays for it. See BuildingCatalogAdapter.Prewarm.
		/// </summary>
		/// <remarks>
		/// The index is ready by now: its full pass runs at OnGameLoaded. A city only, and
		/// only while the asset menu replaces the vanilla one, the case the projections serve.
		/// </remarks>
		protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode)
		{
			base.OnGameLoadingComplete(purpose, mode);

			var source = _indexer.Source;

			if (mode != GameMode.Game || !Mod.Settings.ReplaceVanillaBuildMenu || !source.Index.IsReady)
			{
				return;
			}

			var timer = System.Diagnostics.Stopwatch.StartNew();
			var menus = _buildingCatalogAdapter.Prewarm(
				source, _indexer.Index.Menus.AssetMenus().Select(menu => menu.Id), _toolbarSelection);

			Mod.Log.Debug($"[ASSET-MENU-PREWARM] {menus} menus projected in {timer.ElapsedMilliseconds}ms");
		}
	}
}
