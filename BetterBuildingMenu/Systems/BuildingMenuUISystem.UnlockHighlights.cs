using Colossal.Entities;
using BetterBuildingMenu.Utilities;
using System;
using System.Collections.Generic;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Drops the "newly unlocked" marks under a menu the lens has taken over.
		/// </summary>
		/// <remarks>
		/// ToolbarUISystem drops <see cref="UIHighlight"/> as the player's asset-category
		/// selection moves off a category; the lens replaces the grid instead of selecting
		/// categories in it, and showing a menu whole means all of them have been seen.
		/// </remarks>
		private void ClearVanillaMenuHighlights(string menuName)
		{
			try
			{
				if (!_indexer.Index.Menus.TryGetMenuEntity(menuName, out var menuEntity)
					|| !EntityManager.TryGetBuffer<Game.Prefabs.UIGroupElement>(menuEntity, true, out var categories))
				{
					return;
				}

				var cleared = 0;

				for (var c = 0; c < categories.Length; c++)
				{
					cleared += UnmarkGroup(categories[c].m_Prefab, 0);
				}

				cleared += Unmark(menuEntity);

				if (cleared > 0)
				{
					RefreshVanillaToolbarBindings();
					Mod.Log.Debug($"[UNLOCK-PIP] cleared {cleared} highlight(s) under '{menuName}'");
				}
			}
			catch (Exception ex)
			{
				// A pip that outstays its welcome is not worth failing a menu
				// open over.
				Mod.Log.Warn(ex, $"[UNLOCK-PIP] could not clear highlights under '{menuName}'");
			}
		}

		/// <summary>Unmarks a category and everything in it, down through any categories Extra Lib
		/// nests inside it.</summary>
		private int UnmarkGroup(Entity group, int depth)
		{
			var cleared = 0;

			if (depth <= Domain.NestedCategories.MaxDepth
				&& EntityManager.TryGetBuffer<Game.Prefabs.UIGroupElement>(group, true, out var members))
			{
				for (var m = 0; m < members.Length; m++)
				{
					var member = members[m].m_Prefab;
					cleared += EntityManager.HasBuffer<Game.Prefabs.UIGroupElement>(member)
						? UnmarkGroup(member, depth + 1)
						: Unmark(member);
				}
			}

			return cleared + Unmark(group);
		}

		/// <summary>Removes one highlight, reporting whether there was one.</summary>
		private int Unmark(Entity entity)
		{
			if (entity == Entity.Null || !EntityManager.HasComponent<Game.Prefabs.UIHighlight>(entity))
			{
				return 0;
			}

			EntityManager.RemoveComponent<Game.Prefabs.UIHighlight>(entity);

			return 1;
		}

		/// <summary>
		/// Makes the toolbar redraw after we have removed a highlight.
		/// </summary>
		/// <remarks>
		/// ToolbarUISystem re-binds only on a fresh unlock, so a highlight we drop would sit
		/// on screen; vanilla's UpdateHighlights calls these two private bindings directly.
		/// Cached, and failure is swallowed by the caller: this is cosmetic.
		/// </remarks>
		private void RefreshVanillaToolbarBindings()
		{
			_toolbarGroupsBinding ??= ToolbarField<Colossal.UI.Binding.RawValueBinding>("m_ToolbarGroupsBinding");
			_assetCategoriesBinding ??= ToolbarField<Colossal.UI.Binding.RawMapBinding<Entity>>("m_AssetMenuCategoriesBinding");

			_toolbarGroupsBinding?.Update();
			_assetCategoriesBinding?.UpdateAll();
		}

		/// <summary>A private ToolbarUISystem field, or null once a game update has renamed or retyped it.</summary>
		/// <remarks>Warned about once per field, so the log says why a cleared pip still shows.</remarks>
		private T? ToolbarField<T>(string name) where T : class
		{
			var value = typeof(Game.UI.InGame.ToolbarUISystem)
				.GetField(name, System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
				?.GetValue(_toolbarUISystem) as T;

			if (value is null && _warnedToolbarFields.Add(name))
			{
				Mod.Log.Warn($"[UNLOCK-PIP] ToolbarUISystem.{name} is missing or not a {typeof(T).Name}; a cleared highlight stays drawn until the toolbar next redraws");
			}

			return value;
		}

		private Colossal.UI.Binding.RawValueBinding? _toolbarGroupsBinding;
		private Colossal.UI.Binding.RawMapBinding<Entity>? _assetCategoriesBinding;
		private readonly HashSet<string> _warnedToolbarFields = new();
	}
}
