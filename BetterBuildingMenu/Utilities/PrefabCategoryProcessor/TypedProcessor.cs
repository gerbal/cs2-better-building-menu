using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>A processor that files every prefab of one type its query finds under one subcategory.</summary>
	/// <typeparam name="TPrefab">The prefab type it files; <see cref="PrefabBase"/> takes whatever the query found.</typeparam>
	public abstract class TypedProcessor<TPrefab> : IPrefabCategoryProcessor
		where TPrefab : PrefabBase
	{
		private readonly PrefabCategory _category;
		private readonly PrefabSubCategory _subCategory;

		protected TypedProcessor(ProcessorQuery query, PrefabSubCategory subCategory)
		{
			Query = query;
			_category = subCategory.CategoryOf();
			_subCategory = subCategory;
		}

		public ProcessorQuery Query { get; }

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
		{
			if (prefab is not TPrefab typed || !Accepts(typed, entity))
			{
				prefabIndex = null;
				return false;
			}

			prefabIndex = new PrefabIndex(prefab)
			{
				Category = _category,
				SubCategory = _subCategory,
			};

			return true;
		}

		/// <summary>Whether a prefab of the type is filed, beyond what the query and the type say.</summary>
		protected virtual bool Accepts(TPrefab prefab, Entity entity) => true;
	}
}
