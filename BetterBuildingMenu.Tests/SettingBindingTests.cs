using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// A binding that mirrors one setting: seeded and re-pushed from it, set live by the UI, and
	/// saved back on a commit that changes it.
	/// </summary>
	public sealed class SettingBindingTests
	{
		/// <summary>What the binding publishes, standing in for the live UI binding.</summary>
		private sealed class Published<T> : IBindingValue<T>
		{
			public T? Value { get; set; }

			public IBindingValue<T> Seed(T value)
			{
				Value = value;
				return this;
			}
		}

		/// <summary>One setting, and how often the settings were saved.</summary>
		private sealed class Stored<T>
		{
			public Stored(T value)
			{
				Value = value;
			}

			public T Value { get; set; }

			public int Saves { get; private set; }

			public Action? OnSave { get; set; }

			public void Save()
			{
				Saves++;
				OnSave?.Invoke();
			}
		}

		private static bool SameSize(float stored, float size) => Math.Abs(stored - size) < 0.1f;

		private static SettingBinding<float> Height(Stored<float> stored, Published<float> published) =>
			new(published.Seed, () => stored.Value, value => stored.Value = value, stored.Save, AssetMenuHeight.Clamp, SameSize);

		[Fact]
		public void SeedsTheBindingWithTheStoredSettingSanitized()
		{
			var stored = new Stored<float>(2000f);
			var published = new Published<float>();

			Height(stored, published);

			Assert.Equal(AssetMenuHeight.Max, published.Value);
			Assert.Equal(0, stored.Saves);
		}

		[Fact]
		public void PushPublishesTheSettingAsItIsNow()
		{
			// The settings screen changes the setting, then applies: the push reads it then.
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);

			stored.Value = 300f;
			height.Push();

			Assert.Equal(300f, published.Value);
		}

		[Fact]
		public void PushSanitizesTheStoredSetting()
		{
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);

			stored.Value = float.NaN;
			height.Push();

			Assert.Equal(AssetMenuHeight.Default, published.Value);
		}

		[Fact]
		public void SetPublishesTheValueSanitizedAndSavesNothing()
		{
			// A drag publishes on every move; only the release saves.
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);

			height.Set(50f);

			Assert.Equal(AssetMenuHeight.Min, published.Value);
			Assert.Equal(420f, stored.Value);
			Assert.Equal(0, stored.Saves);
		}

		[Fact]
		public void CommitSavesThePublishedValue()
		{
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);

			height.Set(500f);
			height.Commit();

			Assert.Equal(500f, stored.Value);
			Assert.Equal(1, stored.Saves);
		}

		[Fact]
		public void CommitWritesTheSettingBeforeSaving()
		{
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);
			var atSave = float.NaN;
			stored.OnSave = () => atSave = stored.Value;

			height.Set(500f);
			height.Commit();

			Assert.Equal(500f, atSave);
		}

		[Fact]
		public void CommitLeavesTheSettingsAloneForAValueTheyAlreadyHold()
		{
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);

			height.Set(420.05f);
			height.Commit();

			Assert.Equal(420f, stored.Value);
			Assert.Equal(0, stored.Saves);
		}

		[Fact]
		public void CommitSanitizesWhatTheBindingHolds()
		{
			// The two-name binding publishes what the UI sent before its callback runs.
			var stored = new Stored<float>(420f);
			var published = new Published<float>();
			var height = Height(stored, published);

			published.Value = 5000f;
			height.Commit();

			Assert.Equal(AssetMenuHeight.Max, stored.Value);
		}

		[Fact]
		public void SetAndCommitPublishesAndSavesOnlyAChange()
		{
			var stored = new Stored<bool>(true);
			var published = new Published<bool>();
			var shown = new SettingBinding<bool>(published.Seed, () => stored.Value, value => stored.Value = value, stored.Save);

			shown.SetAndCommit(false);
			shown.SetAndCommit(false);

			Assert.False(published.Value);
			Assert.False(stored.Value);
			Assert.Equal(1, stored.Saves);
		}

		[Fact]
		public void WithoutASanitizerOrComparisonValuesPassAsTheyAreAndEqualityDecidesTheSave()
		{
			var stored = new Stored<int>(100);
			var published = new Published<int>();
			var tile = new SettingBinding<int>(published.Seed, () => stored.Value, value => stored.Value = value, stored.Save);

			Assert.Equal(100, published.Value);

			tile.Set(7);
			Assert.Equal(7, published.Value);

			tile.SetAndCommit(100);
			Assert.Equal(0, stored.Saves);

			tile.SetAndCommit(101);
			Assert.Equal(101, stored.Value);
			Assert.Equal(1, stored.Saves);
		}

		[Fact]
		public void ComparesWithTheSettingAsStoredRatherThanAsPublished()
		{
			// A view the UI does not know, from a file edited by hand, publishes as no pick; picking
			// no pick then writes the file clean.
			var stored = new Stored<string>("tiles");
			var published = new Published<string>();
			var view = new SettingBinding<string>(
				published.Seed,
				() => stored.Value,
				value => stored.Value = value,
				stored.Save,
				AssetMenuViewMode.Sanitize,
				(kept, picked) => !AssetMenuViewMode.ShouldSave(kept, picked));

			Assert.Equal(AssetMenuViewMode.None, published.Value);

			view.SetAndCommit("Grid");

			Assert.Equal(AssetMenuViewMode.None, published.Value);
			Assert.Equal(AssetMenuViewMode.None, stored.Value);
			Assert.Equal(1, stored.Saves);
		}
	}
}
