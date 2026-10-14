using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The box's size as the settings keep it: the double press's game size, and the collapse a Reset opens.</summary>
	public sealed class AssetMenuSizeTests
	{
		[Fact]
		public void ADoublePressBringsBackTheGamesOwnSizeOpen()
		{
			var values = new FakeSettings { AssetMenuHeight = 300f, AssetMenuWidthStep = 4, AssetMenuCollapsed = true };

			Assert.True(AssetMenuSize.Restore(values));
			Assert.Equal((AssetMenuHeight.Default, WidthSteps.DefaultStep, false), (values.AssetMenuHeight, values.AssetMenuWidthStep, values.AssetMenuCollapsed));
		}

		[Theory]
		[InlineData(300f, 1, false)]
		[InlineData(144.25f, 3, false)]
		[InlineData(144.25f, 1, true)]
		public void ADoublePressThatMovesOneOfTheThreeMovesIt(float height, int step, bool collapsed)
		{
			var values = new FakeSettings { AssetMenuHeight = height, AssetMenuWidthStep = step, AssetMenuCollapsed = collapsed };

			Assert.True(AssetMenuSize.Restore(values));
			Assert.Equal((AssetMenuHeight.Default, WidthSteps.DefaultStep, false), (values.AssetMenuHeight, values.AssetMenuWidthStep, values.AssetMenuCollapsed));
		}

		[Fact]
		public void ADoublePressAtTheGamesOwnSizeMovesNothing()
		{
			var values = new FakeSettings();

			Assert.False(AssetMenuSize.Restore(values));
			Assert.Equal(new FakeSettings(), values);
		}

		[Theory]
		[InlineData(144.2501f)]
		[InlineData(144.2f)]
		[InlineData(144.3f)]
		public void ADoublePressAtAHeightWithinTheCommitsToleranceOfTheGamesOwnMovesNothing(float height)
		{
			var values = new FakeSettings { AssetMenuHeight = height };

			Assert.False(AssetMenuSize.Restore(values));
			Assert.Equal(new FakeSettings { AssetMenuHeight = height }, values);
		}

		[Fact]
		public void ADoublePressAtAHeightPastThatToleranceMovesIt()
		{
			var values = new FakeSettings { AssetMenuHeight = 144.4f };

			Assert.True(AssetMenuSize.Restore(values));
			Assert.Equal(AssetMenuHeight.Default, values.AssetMenuHeight);
		}

		[Fact]
		public void ADoublePressLeavesEveryOtherSettingAlone()
		{
			var values = new FakeSettings { AssetMenuHeight = 300f, ControlPaneShown = true, MenuLook = Looks.Plates, AssetMenuTileSize = 100 };

			AssetMenuSize.Restore(values);

			Assert.Equal(new FakeSettings { ControlPaneShown = true, MenuLook = Looks.Plates, AssetMenuTileSize = 100 }, values);
		}

		[Fact]
		public void AResetOpensACollapsedBox()
		{
			var values = new FakeSettings { AssetMenuCollapsed = true };

			SettingsDefaults.Apply(values);

			Assert.False(values.AssetMenuCollapsed);
		}

		[Fact]
		public void AReleaseThatOpensACollapsedBoxSavesItsHeightAndTheOpenAtOnce()
		{
			var values = new FakeSettings { AssetMenuCollapsed = true };

			Assert.True(AssetMenuSize.Commit(values, 202.75f, opens: true));
			Assert.Equal(new FakeSettings { AssetMenuHeight = 202.75f }, values);
		}

		[Fact]
		public void AReleaseAtTheStoredHeightStillOpensACollapsedBox()
		{
			var values = new FakeSettings { AssetMenuCollapsed = true };

			Assert.True(AssetMenuSize.Commit(values, AssetMenuHeight.Default + 0.05f, opens: true));
			Assert.False(values.AssetMenuCollapsed);
		}

		[Theory]
		[InlineData(AssetMenuHeight.Default, false)]
		[InlineData(AssetMenuHeight.Default + 0.05f, false)]
		[InlineData(AssetMenuHeight.Default + 0.2f, true)]
		[InlineData(115f, true)]
		public void AReleaseOfAnOpenBoxSavesOnlyAHeightThatMoved(float height, bool saves)
		{
			var values = new FakeSettings();

			Assert.Equal(saves, AssetMenuSize.Commit(values, height, opens: false));
			Assert.Equal(saves ? height : AssetMenuHeight.Default, values.AssetMenuHeight);
			Assert.False(values.AssetMenuCollapsed);
		}

		[Theory]
		[InlineData(AssetMenuHeight.Default, false)]
		[InlineData(202.75f, true)]
		public void AnUpgradesPanelCommitNeverOpensTheBuildMenu(float height, bool saves)
		{
			var values = new FakeSettings { AssetMenuCollapsed = true };

			Assert.Equal(saves, AssetMenuSize.Commit(values, height, opens: false));
			Assert.True(values.AssetMenuCollapsed);
			Assert.Equal(height, values.AssetMenuHeight);
		}

		[Fact]
		public void AHeightIsCommittedInOneSaveAndOpensOnlyWhereTheUISays()
		{
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");
			var commit = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.AssetMenuSize.cs"), "private void CommitAssetMenuHeight(");

			Assert.Contains("CreateTrigger<bool>(\"CommitAssetMenuHeight\", CommitAssetMenuHeight);", system);
			Assert.Contains("private void CommitAssetMenuHeight(bool opens)", commit);
			Assert.Contains("if (!AssetMenuSize.Commit(Mod.Settings, AssetMenuHeight.Clamp(_AssetMenuHeight), opens)) { return; } Mod.Settings.ApplyAndSave();", commit);
			Assert.Single(System.Text.RegularExpressions.Regex.Matches(commit, "ApplyAndSave"));
		}

		[Fact]
		public void ACollapseIsKeptPublishedAndSavedOnlyWhenItChanges()
		{
			var collapse = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.AssetMenuSize.cs"), "private void SetAssetMenuCollapsed(");

			Assert.Contains("_AssetMenuCollapsed.Value = collapsed; if (Mod.Settings.AssetMenuCollapsed == collapsed) { return; }", collapse);
			Assert.Contains("Mod.Settings.AssetMenuCollapsed = collapsed; Mod.Settings.ApplyAndSave();", collapse);
		}

		[Fact]
		public void ARestoreSavesOnceAndOnlyWhenItMovesSomething()
		{
			var restore = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.AssetMenuSize.cs"), "private void RestoreAssetMenuSize(");

			Assert.Contains("if (!AssetMenuSize.Restore(Mod.Settings)) { return; } Mod.Settings.ApplyAndSave();", restore);
		}

		[Fact]
		public void TheCollapseFollowsOptionsAndResetAtOnce()
		{
			Assert.Contains(
				"_AssetMenuCollapsed.Value = Mod.Settings.AssetMenuCollapsed;",
				ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied("));
		}
	}
}
