using BetterBuildingMenu.Domain;

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
			Assert.Equal(new HandOff(HandOffAction.Yield, Roads), MenuOwnership.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: Roads, recorded: 0));
		}

		[Fact]
		public void PickingUpAGamepadWithNoMenuOfOursChangesNothing()
		{
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: 0, recorded: 0));
			Assert.Equal(new HandOff(HandOffAction.None, Roads), MenuOwnership.SchemeChanged(gamepad: true, replaceEnabled: true, ownedMenu: 0, recorded: Roads));
		}

		[Fact]
		public void BackToTheMouseReopensTheRecordedMenuOnce()
		{
			Assert.Equal(new HandOff(HandOffAction.Reopen, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, recorded: Roads));
		}

		[Fact]
		public void BackToTheMouseAfterTheMenuClosedOpensNothing()
		{
			// A menu closing under the gamepad clears the record, so there is nothing to take back.
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: true, ownedMenu: 0, recorded: 0));
		}

		[Fact]
		public void BackToTheMouseWithReplaceOffOpensNothingAndForgets()
		{
			Assert.Equal(new HandOff(HandOffAction.None, 0), MenuOwnership.SchemeChanged(gamepad: false, replaceEnabled: false, ownedMenu: 0, recorded: Roads));
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
			var handler = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs"), "private void OnControlSchemeChanged(InputManager.ControlScheme scheme)");
			var nullCheck = handler.IndexOf("if (Mod.Settings is null)", StringComparison.Ordinal);

			Assert.True(nullCheck >= 0, "the handler must return when Mod.Settings is gone");
			Assert.True(nullCheck < handler.IndexOf("try", StringComparison.Ordinal), "the null check comes before anything reads the settings");
			Assert.Contains("catch (System.Exception", handler);
			Assert.Equal(1, handler.Split("Mod.Log.Warn(").Length - 1);
			Assert.Contains("_controlSchemeWarned", handler);
		}

		[Fact]
		public void AClosedToolbarMenuForgetsTheRecordBeforeAnythingElse()
		{
			var deselected = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.MenuTakeover.cs"), "private void VanillaMenuDeselected()");
			var forget = deselected.IndexOf("_gamepadMenuIndex = 0;", StringComparison.Ordinal);

			Assert.True(forget >= 0, "VanillaMenuDeselected keeps the gamepad's record");
			Assert.True(
				forget < deselected.IndexOf("if (!Mod.Settings.ReplaceVanillaBuildMenu", StringComparison.Ordinal),
				"the record must go before the check that returns for a menu BBM does not stand in for");
		}

		[Fact]
		public void TheReplaceRowSaysAControllerGetsTheGamesMenu()
		{
			Assert.EndsWith(
				" With a controller, the game's own build menu shows.",
				ModSource.English("Options.OPTION_DESCRIPTION[BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.ReplaceVanillaBuildMenu]"));
		}
	}
}
