using BetterBuildingMenu.Domain;

using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Whose build menu stands in for the toolbar's open menu: BBM's with the mouse, the game's own
	/// under a gamepad, and the same menu again when the mouse returns.
	/// </summary>
	public sealed class MenuOwnershipTests
	{
		private const int Roads = 42;
		private const int Electricity = 7;

		[Theory]
		[InlineData(true, false, true)]
		[InlineData(true, true, false)]
		[InlineData(false, false, false)]
		[InlineData(false, true, false)]
		public void BbmStandsInOnlyWithReplaceOnAndNoGamepad(bool replaceEnabled, bool gamepad, bool owns)
		{
			Assert.Equal(owns, MenuOwnership.MayOwn(replaceEnabled, gamepad));
		}

		[Fact]
		public void PickingUpAGamepadGivesAnOpenMenuToTheGameAndRecordsIt()
		{
			Assert.Equal(new HandOff(HandOffAction.Yield, Roads), MenuOwnership.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: Roads, recorded: 0, toolbarHasMenu: true));
		}

		[Fact]
		public void PickingUpAGamepadWithNoMenuOfOursChangesNothing()
		{
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: 0, recorded: 0, toolbarHasMenu: false));
			Assert.Equal(new HandOff(HandOffAction.None, Roads), MenuOwnership.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: 0, recorded: Roads, toolbarHasMenu: true));
		}

		[Fact]
		public void BackToTheMouseReopensTheRecordedMenuOnce()
		{
			Assert.Equal(new HandOff(HandOffAction.Reopen, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, recorded: Roads, toolbarHasMenu: true));
		}

		[Fact]
		public void BackToTheMouseAfterTheMenuClosedOpensNothing()
		{
			// A menu closing under the gamepad clears the record, so there is nothing to take back.
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, recorded: 0, toolbarHasMenu: true));
		}

		[Fact]
		public void BackToTheMouseWithReplaceOffOpensNothingAndForgets()
		{
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: false, ownedMenu: 0, recorded: Roads, toolbarHasMenu: true));
		}

		[Fact]
		public void BackToTheMouseWithTheToolbarsMenuGoneOpensNothingAndForgets()
		{
			// A load clears the toolbar with no deselect reaching BBM, so the record outlives the menu.
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, recorded: Roads, toolbarHasMenu: false));
		}

		[Fact]
		public void AMenuOpenedUnderAGamepadStaysTheGamesAndIsRecorded()
		{
			Assert.Equal(new HandOff(HandOffAction.Yield, Electricity), MenuOwnership.MenuSelected(gamepad: true, menu: Electricity));
		}

		[Fact]
		public void AMenuOpenedWithTheMouseIsOurs()
		{
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.MenuSelected(gamepad: false, menu: Electricity));
		}

		[Fact]
		public void AMenuGivenUpForTheGamepadReturnsWithTheMouseWhileTheToolbarHasIt()
		{
			var record = new GamepadMenuRecord();

			Assert.Equal(HandOffAction.Yield, record.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: Roads, toolbarHasMenu: true, out _));
			Assert.Equal(Roads, record.Menu);

			Assert.Equal(HandOffAction.Reopen, record.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, toolbarHasMenu: true, out var reopen));
			Assert.Equal(Roads, reopen);
			Assert.Equal(0, record.Menu);
		}

		[Fact]
		public void AMenuOpenedUnderTheGamepadReturnsWithTheMouse()
		{
			var record = new GamepadMenuRecord();

			Assert.Equal(HandOffAction.Yield, record.MenuSelected(gamepad: true, menu: Electricity));
			Assert.Equal(HandOffAction.Reopen, record.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, toolbarHasMenu: true, out var reopen));
			Assert.Equal(Electricity, reopen);
		}

		[Fact]
		public void AMenuOpenedWithTheMouseLeavesTheRecordAlone()
		{
			var record = new GamepadMenuRecord();

			Assert.Equal(HandOffAction.None, record.MenuSelected(gamepad: false, menu: Electricity));
			Assert.Equal(0, record.Menu);
		}

		[Fact]
		public void ARecordTheToolbarNoLongerBacksReopensNothing()
		{
			var record = Recorded(Roads);

			Assert.Equal(HandOffAction.None, record.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, toolbarHasMenu: false, out _));
			Assert.Equal(0, record.Menu);
		}

		[Fact]
		public void AClosedMenuOrALoadForgetsTheRecord()
		{
			// The toolbar's deselect and the game's preload both forget.
			var record = Recorded(Roads);

			record.Forget();

			Assert.Equal(0, record.Menu);
			Assert.Equal(HandOffAction.None, record.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, toolbarHasMenu: true, out _));
		}

		[Fact]
		public void SettingsAppliedWithReplaceOffForgetTheRecordAndWithItOnKeepIt()
		{
			var kept = Recorded(Roads);
			var forgotten = Recorded(Roads);

			kept.SettingsApplied(replaceEnabled: true);
			forgotten.SettingsApplied(replaceEnabled: false);
			forgotten.SettingsApplied(replaceEnabled: true);

			Assert.Equal(Roads, kept.Menu);
			Assert.Equal(0, forgotten.Menu);
			Assert.Equal(HandOffAction.None, forgotten.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, toolbarHasMenu: true, out _));
		}

		/// <summary>A record holding a menu given up when the gamepad was picked up.</summary>
		private static GamepadMenuRecord Recorded(int menu)
		{
			var record = new GamepadMenuRecord();
			record.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: menu, toolbarHasMenu: true, out _);

			return record;
		}

		[Fact]
		public void TheSystemListensForTheSchemeAndStopsListening()
		{
			var system = ModSource.Text("Systems/BuildingMenuUISystem.cs");
			var create = ModSource.Member(system, "protected override void OnCreate()");

			Assert.Contains("EventControlSchemeChanged += OnControlSchemeChanged;", create);
			Assert.Contains("EventControlSchemeChanged -= OnControlSchemeChanged;", ModSource.Member(system, "protected override void OnDestroy()"));
			Assert.True(
				create.IndexOf("EventControlSchemeChanged +=", StringComparison.Ordinal) > create.IndexOf("CreateBinding(\"OwnsCurrentMenu\"", StringComparison.Ordinal),
				"the handler reads bindings, so it is subscribed after they are created");
		}

		[Fact]
		public void TheSchemeHandlerDoesNothingWithoutSettingsAndNeverThrows()
		{
			var handler = SchemeHandler();
			var nullCheck = handler.IndexOf("if (Mod.Settings is null) { return; }", StringComparison.Ordinal);

			Assert.True(nullCheck >= 0, "the handler must return when Mod.Settings is gone");
			Assert.True(nullCheck < handler.IndexOf("try {", StringComparison.Ordinal), "the null check comes before anything reads the settings");
			Assert.Contains(
				"catch (System.Exception ex) { if (!_controlSchemeWarned) { _controlSchemeWarned = true; Mod.Log.Warn(ex, \"Could not hand the build menu over for a control scheme change\"); } }",
				handler);
			Assert.Single(Regex.Matches(handler, Regex.Escape("Mod.Log.Warn(")));
		}

		[Fact]
		public void TheSchemeHandlerAsksTheToolbarWhetherItStillHasAMenuAndReopensTheRecordedOne()
		{
			var handler = SchemeHandler();

			Assert.Contains(
				"_gamepadMenu.SchemeChanged( scheme == InputManager.ControlScheme.Gamepad, Mod.Settings.ReplaceVanillaBuildMenu, _OwnsCurrentMenu.Value ? _appliedMenuIndex : 0, _toolbarUISystem.hasActiveSelection, out var reopen)",
				handler);
			Assert.Contains("_appliedMenuFrame = null; VanillaMenuSelected(reopen); break;", handler);
		}

		[Fact]
		public void AMenuOpenedUnderTheGamepadIsRecordedAndLeftToTheGame()
		{
			var selected = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs"), "private void VanillaMenuSelected(int menuEntityIndex)");

			Assert.Contains(
				"if (_gamepadMenu.MenuSelected(InputManager.instance?.isGamepadControlSchemeActive == true, menuEntityIndex) == HandOffAction.Yield) { YieldMenuToVanilla(); return; }",
				selected);
		}

		[Fact]
		public void AClosedToolbarMenuForgetsTheRecordBeforeAnythingElse()
		{
			var deselected = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs"), "private void VanillaMenuDeselected()");
			var forget = deselected.IndexOf("_gamepadMenu.Forget();", StringComparison.Ordinal);

			Assert.True(forget >= 0, "VanillaMenuDeselected keeps the gamepad's record");
			Assert.True(
				forget < deselected.IndexOf("if (!Mod.Settings.ReplaceVanillaBuildMenu", StringComparison.Ordinal),
				"the record must go before the check that returns for a menu BBM does not stand in for");
		}

		[Fact]
		public void ALoadOrAReturnToTheMainMenuForgetsTheRecord()
		{
			// The toolbar is cleared while the UI is gone, so no deselect arrives.
			var preload = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "protected override void OnGamePreload(Purpose purpose, GameMode mode)");

			Assert.Contains("base.OnGamePreload(purpose, mode);", preload);
			Assert.Contains("_gamepadMenu.Forget();", preload);
		}

		[Fact]
		public void EverySettingsApplyTellsTheRecordWhetherReplaceIsOnNotOnlyWhileBbmOwnsTheMenu()
		{
			// With Replace off the UI sends no deselect, whoever has the menu.
			var applied = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied(Game.Settings.Setting setting)");
			const string Tell = "_gamepadMenu.SettingsApplied(Mod.Settings.ReplaceVanillaBuildMenu);";

			Assert.Contains(Tell, applied);
			Assert.DoesNotContain(Tell, ModSource.Member(applied, "if (!Mod.Settings.ReplaceVanillaBuildMenu && _OwnsCurrentMenu.Value)"));
		}

		private static string SchemeHandler() =>
			ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs"), "private void OnControlSchemeChanged(InputManager.ControlScheme scheme)");

		[Fact]
		public void TheReplaceRowSaysAControllerGetsTheGamesMenu()
		{
			Assert.EndsWith(
				" With a controller, the game's own build menu shows.",
				ModSource.English("Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.ReplaceVanillaBuildMenu]"));
		}
	}
}
