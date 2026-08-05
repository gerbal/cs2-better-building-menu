using Colossal.UI.Binding;

using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The stable, UI-facing projection of a building already present in FindIt's
	/// prefab index. It intentionally contains no ECS handles or mutable prefab
	/// objects so catalog work can remain separate from indexing and placement.
	/// </summary>
	public sealed record BuildingCatalogEntry(
		int Id,
		string PrefabName,
		string Name,
		string Category,
		string SubCategory,
		string Thumbnail,
		int LotWidth,
		int LotDepth,
		int BuildingLevel,
		ZoneTypeFilter ZoneType,
		bool HasParking,
		bool IsUniqueMesh,
		bool IsVanilla,
		bool IsFavorited,
		string PdxModsId,
		double? ConstructionCost = null,
		double? Upkeep = null,
		double? Workers = null,
		double? Capacity = null,
		double? ElectricityConsumption = null,
		double? WaterConsumption = null,
		double? GarbageAccumulation = null,
		double? WaterCapacity = null,
		double? SewageCapacity = null,
		double? GroundPollution = null,
		double? AirPollution = null,
		double? NoisePollution = null,
		string? BuildingType = null,
		string? Provenance = null,
		string? DlcId = null,
		string? Theme = null,
		string[]? AssetPacks = null,
		string[]? PlacementFlags = null,
		string? VanillaSection = null,
		string? VanillaSubCategory = null,
		string[]? Extensions = null,
		string? CategoryLabel = null,
		string? SubCategoryLabel = null) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("prefabName");
			writer.Write(PrefabName);
			writer.PropertyName("name");
			writer.Write(Name);
			writer.PropertyName("category");
			writer.Write(Category);
			writer.PropertyName("subCategory");
			writer.Write(SubCategory);
			writer.PropertyName("categoryLabel");
			writer.Write(CategoryLabel ?? Category);
			writer.PropertyName("subCategoryLabel");
			writer.Write(SubCategoryLabel ?? SubCategory);
			writer.PropertyName("vanillaSection");
			writer.Write(VanillaSection ?? string.Empty);
			writer.PropertyName("vanillaSubCategory");
			writer.Write(VanillaSubCategory ?? string.Empty);
			writer.PropertyName("thumbnail");
			writer.Write(Thumbnail);
			writer.PropertyName("lotWidth");
			writer.Write(LotWidth);
			writer.PropertyName("lotDepth");
			writer.Write(LotDepth);
			writer.PropertyName("buildingLevel");
			writer.Write(BuildingLevel);
			writer.PropertyName("zoneType");
			writer.Write((int)ZoneType);
			writer.PropertyName("hasParking");
			writer.Write(HasParking);
			writer.PropertyName("isUniqueMesh");
			writer.Write(IsUniqueMesh);
			writer.PropertyName("isVanilla");
			writer.Write(IsVanilla);
			writer.PropertyName("isFavorited");
			writer.Write(IsFavorited);
			writer.PropertyName("pdxModsId");
			writer.Write(PdxModsId);
			writer.PropertyName("buildingType");
			writer.Write(BuildingType ?? string.Empty);
			writer.PropertyName("provenance");
			writer.Write(Provenance ?? string.Empty);
			writer.PropertyName("dlcId");
			writer.Write(DlcId ?? string.Empty);
			writer.PropertyName("theme");
			writer.Write(Theme ?? string.Empty);
			WriteStringArray(writer, "assetPacks", AssetPacks);
			WriteStringArray(writer, "placementFlags", PlacementFlags);
			WriteStringArray(writer, "extensions", Extensions);
			WriteNullable(writer, "constructionCost", ConstructionCost);
			WriteNullable(writer, "upkeep", Upkeep);
			WriteNullable(writer, "workers", Workers);
			WriteNullable(writer, "capacity", Capacity);
			WriteNullable(writer, "electricityConsumption", ElectricityConsumption);
			WriteNullable(writer, "waterConsumption", WaterConsumption);
			WriteNullable(writer, "garbageAccumulation", GarbageAccumulation);
			WriteNullable(writer, "waterCapacity", WaterCapacity);
			WriteNullable(writer, "sewageCapacity", SewageCapacity);
			WriteNullable(writer, "groundPollution", GroundPollution);
			WriteNullable(writer, "airPollution", AirPollution);
			WriteNullable(writer, "noisePollution", NoisePollution);

			writer.TypeEnd();
		}

		private static void WriteNullable(IJsonWriter writer, string propertyName, double? value)
		{
			writer.PropertyName(propertyName);
			if (value.HasValue)
			{
				writer.Write(value.Value);
			}
			else
			{
				writer.WriteNull();
			}
		}

		private static void WriteStringArray(IJsonWriter writer, string propertyName, IEnumerable<string>? values)
		{
			writer.PropertyName(propertyName);
			string[] normalized = values?.Where(value => !string.IsNullOrWhiteSpace(value)).ToArray() ?? Array.Empty<string>();
			writer.ArrayBegin((uint)normalized.Length);
			foreach (string value in normalized)
			{
				writer.Write(value);
			}
			writer.ArrayEnd();
		}
	}
}
