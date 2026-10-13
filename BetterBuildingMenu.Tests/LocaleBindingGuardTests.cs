using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Nothing the mod does about the active language may reach the game's language switch: its
	/// handler runs inside the game's own, and a throw there would fail the switch.
	/// </summary>
	public sealed class LocaleBindingGuardTests
	{
		private static string Source => ModSource.Text("Systems/BuildingMenuUISystem.Locale.cs");

		private static string Create => ModSource.Member(Source, "private void CreateLocaleBindings()");

		private static string Handler => ModSource.Member(Source, "private void OnLocaleChanged()");

		[Fact]
		public void TheHandlersBodyIsGuarded()
		{
			var handler = Handler;
			var read = handler.IndexOf("UntranslatedKeys(", StringComparison.Ordinal);

			Assert.True(read >= 0, "the handler still reads the untranslated keys");
			Assert.True(handler.IndexOf("try {", StringComparison.Ordinal) is var open && open >= 0 && open < read, "the read sits inside a try");
			Assert.True(handler.IndexOf("catch (Exception e) { WarnLocaleOnce(e); }", StringComparison.Ordinal) > read, "and the catch follows it");
		}

		[Fact]
		public void TheSubscribeIsGuarded()
		{
			var create = Create;
			var subscribe = create.IndexOf("onActiveDictionaryChanged += OnLocaleChanged;", StringComparison.Ordinal);
			var open = create.LastIndexOf("try {", subscribe, StringComparison.Ordinal);

			Assert.True(subscribe >= 0, "the mod still subscribes");
			Assert.True(open >= 0 && !create.Substring(open, subscribe - open).Contains('}'), "the subscribe is the body of a try");
			Assert.True(create.IndexOf("catch (Exception e) { WarnLocaleOnce(e); }", subscribe, StringComparison.Ordinal) > subscribe, "that try has the same catch");
		}

		[Fact]
		public void ADeadLanguageSwitchIsLoggedOnceWithTheExceptionsMessage()
		{
			var warn = ModSource.Member(Source, "private void WarnLocaleOnce(Exception e)");

			Assert.Contains("if (_localeWarned) { return; }", warn);
			Assert.Contains("_localeWarned = true;", warn);
			Assert.Single(Regex.Matches(warn, Regex.Escape("Mod.Log.Warn(")));
			Assert.Contains("e.Message", warn);
		}
	}
}
