using BetterBuildingMenu.Domain;

using System;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// When a dictionary change earns a full pass: at once for a language the
	/// player switched to, once and late for the sources mods add while loading.
	/// </summary>
	/// <remarks>
	/// The game raises onActiveDictionaryChanged for every source added or removed,
	/// not only for a language change, and a full pass costs seconds. Eight of them
	/// in a minute at the main menu was the bug this pins.
	/// </remarks>
	public sealed class LocaleReindexPolicyTests
	{
		private static readonly TimeSpan Quiet = TimeSpan.FromSeconds(1);
		private static readonly TimeSpan T0 = TimeSpan.FromSeconds(100);

		[Fact]
		public void IgnoresEventsBeforeAnythingWasIndexed()
		{
			// Nothing cached, nothing stale: the first full pass reads the
			// dictionary as it stands then.
			var policy = new LocaleReindexPolicy(Quiet);

			Assert.Equal(LocaleReindexDecision.None, policy.Observe("en-US", T0));
			Assert.False(policy.TryFireDeferred(T0 + Quiet + Quiet));
		}

		[Fact]
		public void DefersASourceAddedInTheIndexedLocale()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");

			Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("en-US", T0));
			Assert.False(policy.TryFireDeferred(T0));
			Assert.True(policy.TryFireDeferred(T0 + Quiet));
			// Consumed: the next frame must not run a second pass.
			Assert.False(policy.TryFireDeferred(T0 + Quiet + Quiet));
		}

		[Fact]
		public void ABurstOfSourcesIsOnePassAfterTheLast()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");

			for (var i = 0; i < 8; i++)
			{
				Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("en-US", T0 + TimeSpan.FromMilliseconds(200 * i)));
			}

			var last = T0 + TimeSpan.FromMilliseconds(1400);
			Assert.False(policy.TryFireDeferred(last + TimeSpan.FromMilliseconds(999)));
			Assert.True(policy.TryFireDeferred(last + Quiet));
			Assert.False(policy.TryFireDeferred(last + Quiet + Quiet));
		}

		[Fact]
		public void RunsAtOnceForALanguageThePlayerSwitchedTo()
		{
			// Every cached name is in the wrong language: a late pass would show
			// the old one for a second. And the switch supersedes any deferral.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("en-US", T0);

			Assert.Equal(LocaleReindexDecision.Immediate, policy.Observe("de-DE", T0 + TimeSpan.FromMilliseconds(100)));
			Assert.False(policy.TryFireDeferred(T0 + Quiet + Quiet));
		}

		[Fact]
		public void AFullPassForAnyReasonCoversAPendingDeferral()
		{
			// The save's own pass at OnGameLoaded reads the dictionary as it
			// stands; the deferred one after it would be a repeat.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("en-US", T0);

			policy.MarkIndexed("en-US");

			Assert.False(policy.TryFireDeferred(T0 + Quiet + Quiet));
		}

		[Fact]
		public void ASourceAfterTheSwitchIsDeferredAgainstTheNewLocale()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			Assert.Equal(LocaleReindexDecision.Immediate, policy.Observe("de-DE", T0));
			policy.MarkIndexed("de-DE");

			Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("de-DE", T0 + Quiet));
		}
	}
}
