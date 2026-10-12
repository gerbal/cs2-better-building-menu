using BetterBuildingMenu.Domain;

using System.Reflection;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The settings class's shape, read by reflection and as text, and what Reset the build menu…
	/// puts back, on the plain object the migration's tests load files into.
	/// </summary>
	public sealed class SettingsShapeTests
	{
		private const double SixteenNine = 1920.0 / 1080.0;

		private static readonly PriorInstall StampOnly = new(null, StampExisted: true);

		/// <summary>The settings the class stores: a public getter and setter, which the game's loader reads and writes.</summary>
		private static IEnumerable<PropertyInfo> StoredSettings() => typeof(BetterBuildingMenuSettings)
			.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
			.Where(property => property.GetMethod?.IsPublic == true && property.SetMethod?.IsPublic == true);

		/// <summary>Every value the migration and Reset reach, each moved off how it ships.</summary>
		private static FakeSettings EveryValueMoved()
		{
			var values = new FakeSettings();

			foreach (var property in typeof(FakeSettings).GetProperties())
			{
				property.SetValue(values, Moved(property.GetValue(values)));
			}

			return values;
		}

		/// <summary>A value moved off its own, boxed as its own type, so an int stays an int.</summary>
		private static object Moved(object? value) => value switch
		{
			bool flag => (object)!flag,
			int number => (object)(number + 7),
			float number => (object)(number + 7f),
			string text => (object)(text + "x"),
			_ => throw new NotSupportedException("No setting is a " + value?.GetType().Name),
		};

		[Fact]
		public void EverySettingTheClassStoresIsOneTheDefaultsReach()
		{
			var stored = StoredSettings().Select(property => property.Name).OrderBy(name => name, StringComparer.Ordinal);
			var reached = typeof(ISettingsValues).GetProperties().Select(property => property.Name).OrderBy(name => name, StringComparer.Ordinal);

			Assert.Equal(reached, stored);
		}

		[Fact]
		public void TheDefaultsPutEveryValueBackButTheVersionAndTheLegacyWidth()
		{
			var values = EveryValueMoved();

			SettingsDefaults.Apply(values);

			Assert.Equal(new FakeSettings { SettingsVersion = 7, AssetMenuCatalogWidth = Domain.AssetMenuCatalogWidth.Default + 7f }, values);
		}

		[Fact]
		public void AResetStoresThisReleasesVersion()
		{
			var values = EveryValueMoved() with { SettingsVersion = 1 };

			SettingsDefaults.Reset(values);

			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current, AssetMenuCatalogWidth = Domain.AssetMenuCatalogWidth.Default + 7f }, values);
		}

		[Fact]
		public void AResetKeepsALaterReleasesVersion()
		{
			var values = new FakeSettings { SettingsVersion = SettingsMigration.Current + 5, AssetMenuTileSize = 120 };

			SettingsDefaults.Reset(values);

			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current + 5 }, values);
		}

		[Fact]
		public void ALoadAfterAResetMigratesNothingEvenWhenTheMigrationNeverRan()
		{
			// A 0.2.4 file whose migration fails this load: it is still at version 0 when the player resets.
			var loaded = SettingsFile.Read(SettingsFixtures.Height155Width0PaneShown);
			var values = loaded.Values with { };

			SettingsDefaults.Reset(values);

			var reloaded = SettingsFile.Read(GameSave.Write(loaded.Keys, values));
			var next = SettingsMigration.Migrate(reloaded.Values, reloaded.Keys, StampOnly, SixteenNine);

			Assert.False(next.Changed, "the next load changed " + string.Join("; ", next.Changes));
			Assert.Null(next.Decision);
			Assert.Equal(new FakeSettings { SettingsVersion = SettingsMigration.Current }, reloaded.Values);
		}

		[Fact]
		public void TheTestSettingsStartWhereTheSettingsClassDoes()
		{
			var source = ModSource.Text("Setting.cs");

			Assert.Contains("public float AssetMenuHeight { get; set; } = Domain.AssetMenuHeight.Default;", source);
			Assert.Contains("public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;", source);
			Assert.Contains("public int AssetMenuWidthStep { get; set; } = Domain.WidthSteps.DefaultStep;", source);
			Assert.Contains("public bool ControlPaneShown { get; set; } = Domain.SettingsDefaults.ControlPaneShown;", source);
			Assert.Contains("public string AssetMenuViewMode { get; set; } = Domain.AssetMenuViewMode.None;", source);
			Assert.Contains("public bool ReplaceVanillaBuildMenu { get; set; } = Domain.SettingsDefaults.ReplaceVanillaBuildMenu;", source);
			Assert.Contains("public int AssetMenuTileSize { get; set; } = Domain.SettingsDefaults.TileSize;", source);

			// No initializer: false or 0, as FakeSettings has them.
			foreach (var bare in new[] { "int SettingsVersion", "bool Upgrader", "bool AutoWidenSearch" })
			{
				Assert.Matches("public " + bare + @" \{ get; set; \}\r?\n", source);
			}
		}

		[Fact]
		public void SetDefaultsIsTheShippedValues()
		{
			Assert.Equal(
				"public override void SetDefaults() { Domain.SettingsDefaults.Apply(this); }",
				ModSource.Member(ModSource.Text("Setting.cs"), "public override void SetDefaults()"));
		}
	}
}
